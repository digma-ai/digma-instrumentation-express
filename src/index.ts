import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import getFunctionLocation from 'get-function-location';

interface RouteDetails {
    filePath: string;
    function: string;
    route: string;
    line: number;
}

const routesMap = new Map<string, RouteDetails>();

export interface DigmaInstrumentationOptions {
    handleUncaughtExceptions?: boolean
}

export function applyDigmaInstrumentation(sdk: NodeSDK, options?: DigmaInstrumentationOptions) {
    if(options?.handleUncaughtExceptions) {
        process.on('uncaughtException', handleUncaughtException);
    }
    
    setHookToApplySemanticAttributes(sdk);
}

export async function digmaRouteHandler(req, res, next) {
    const span = getActiveSpan();
    try {
        next();
        if (req.route) {
            await handleRoute(req, span);
        }
    }
    catch (error) {
        next(error);
    }
}

function setHookToApplySemanticAttributes(sdk: NodeSDK) {
    const httpInstrumentation = sdk
        // @ts-ignore: we need access to the private member _instrumentations
        ._instrumentations[0]
        .find(i => i.instrumentationName === '@opentelemetry/instrumentation-http');

    const existingHook = httpInstrumentation.getConfig().applyCustomAttributesOnSpan;

    httpInstrumentation.setConfig({
        applyCustomAttributesOnSpan: function (span, request, response) {
            if (existingHook) {
                existingHook.call(httpInstrumentation, span, request, response);
            }

            const requestId = getRequestId(request);
            if (routesMap.has(requestId)) {
                const routeInfo = routesMap.get(requestId);
                setSemanticAttributesForRoute(span, routeInfo);
            }
        },
    });
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

function getActiveSpan(): Span | undefined {
    const activeContext = context.active();
    const span = trace.getSpan(activeContext);
    return span;
}

function getRequestId(request) {
    return `${request.method}:${request.baseUrl}${request.path}`;
}    

function setSemanticAttributesForRoute(span?: Span, routeDetails?: RouteDetails) {
    if(routeDetails) {
        span?.setAttribute(SemanticAttributes.CODE_FILEPATH, routeDetails.filePath);
        span?.setAttribute(SemanticAttributes.CODE_LINENO, routeDetails.line);
        span?.setAttribute(SemanticAttributes.CODE_FUNCTION, routeDetails.function);
    }    
}    

function handleUncaughtException(err) {
    const span = getActiveSpan();
    if(span) {
        try {
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        }
        finally {
            span.end();
        }
    }
}
