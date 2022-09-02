import type * as express from 'express';
import * as core from 'express-serve-static-core';
import { trace, context, Span } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { name } from '../package.json';

import getFunctionLocation from 'get-function-location';

export interface RouteDetails {
    filePath: string;
    function: string;
    route: string;
    line: number;
}

const routesMap = new Map<string, RouteDetails>();

function setSemanticAttributesForRoute(span?: Span, routeDetails?: RouteDetails) {
    if(routeDetails) {
        span?.setAttribute(SemanticAttributes.CODE_FILEPATH, routeDetails.filePath);
        span?.setAttribute(SemanticAttributes.CODE_LINENO, routeDetails.line);
        span?.setAttribute(SemanticAttributes.CODE_FUNCTION, routeDetails.function);
    }
}

function getRequestId(request) {
    return `${request.method}:${request.baseUrl}${request.path}`;
}

async function handleRoute(req, span: Span | undefined) {
    const requestId = getRequestId(req);
    if(!routesMap.has(requestId)) {
        const layer = req.route.stack[0];
        const location = await getFunctionLocation(layer.handle);
        if (location) {
            const routeDetails: RouteDetails = {
                filePath: location.source,
                line: location.line,
                function: layer.name,
                route: req.baseUrl + req.route.path,
            };
            routesMap.set(requestId, routeDetails);
        }
    }
}

export function useDigmaRouterMiddleware(router: express.Router) {
    router.use(async function (req, res, next) {
        const activeContext = context.active();
        const rootSpan = trace.getSpan(activeContext);
        next();
        if (req.route) {
            await handleRoute(req, rootSpan);
        }
    })
}

export function useDigmaRouterMiddlewareAsync(router: express.Router) {
    router.use(async function (req, res, next) {
        const tracer = trace.getTracerProvider().getTracer(name);
        await tracer.startActiveSpan('middleware - digma', async span => {
            console.log("router middleware digma - before");
            next();
            console.log("router middleware digma - after");
            if (req.route) {
                await handleRoute(req, span);
                span.end();
            }
        });
    })
}

export function useDigmaAppMiddleware(app: express.Application) {
    app.use((req, res, next) => {
        const tracer = trace.getTracerProvider().getTracer(name);
        tracer.startActiveSpan('middleware - digma', span => {
            console.log("app middleware digma - before");
            next();
            console.log("app middleware digma - after");
            handleRoute(req, span);
            span.end();
        });
    });
}

export function useDigmaAppMiddlewareAsync(app: express.Application) {
    app.use(async (req, res, next) => {
        const tracer = trace.getTracerProvider().getTracer(name);
        await tracer.startActiveSpan('middleware - digma', async span => {
            console.log("app middleware digma - before");
            next();
            console.log("app middleware digma - after");
            await handleRoute(req, span);
            span.end();
        });
    });
}

export function applyDigmaInstrumentation(sdk: NodeSDK) {
    const httpInstrumentation = sdk
        // @ts-ignore: we need access to the private member _instrumentations
        ._instrumentations[0]
        .find(i => i.instrumentationName === '@opentelemetry/instrumentation-http');

    const existingHook = httpInstrumentation.getConfig().applyCustomAttributesOnSpan;

    httpInstrumentation.setConfig({
        applyCustomAttributesOnSpan: function (span, request, response) {
            if(existingHook) {
                existingHook.call(httpInstrumentation, span, request, response);
            }

            const requestId = getRequestId(request);
            if(routesMap.has(requestId)) {
                const routeInfo = routesMap.get(requestId);
                setSemanticAttributesForRoute(span, routeInfo);
            }
        },
    });
}
