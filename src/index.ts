import type * as express from 'express';
import * as core from 'express-serve-static-core';
import { trace, context, Span } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { name } from '../package.json';

import getFunctionLocation from 'get-function-location';

//type Request = core.Request<core.ParamsDictionary, any, any, QueryString.ParsedQs, Record<string, any>>

export interface RouteDetails {
    filePath: string;
    function: string;
    route: string;
    line: number;
    // regexp: string;
}

const routesMap: Record<string, RouteDetails> = {};

// function split (thing: any): string [] {
//     if (typeof thing === 'string') {
//       return thing.split('/')
//     } else if (thing.fast_slash) {
//       return []
//     } else {
//       var match = thing.toString()
//         .replace('\\/?', '')
//         .replace('(?=\\/|$)', '$')
//         .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//)
//       return match
//         ? match[1].replace(/\\(.)/g, '$1').split('/')
//         : '<complex:' + thing.toString() + '>'
//     }
//   }

// function iterate (path: string [] = [], layer: any) {
//     if (layer.route) {
//         for(let l of layer.route.stack){
//             const paths = split(layer.route.path);
//             iterate(path.concat(paths), l);
//         }
//         return;
//     }
//     if (layer.name === 'router') {
//         let stack;
//         if (layer.handle.__original.stack) {
//             stack = layer.handle.__original.stack;
//         }
//         else {
//             stack = layer.handle.stack;
//         }
//         if (stack) {
//             for(let l of stack){
//                 iterate(path.concat(split(layer.regexp)), l);
//             }
//             return;
//         }
//     }
//     if (layer.method) {
//         const routePath = '/'+path.concat(split(layer.regexp)).filter(Boolean).join('/');
//         routesMap[routePath] = {
//             filePath: "",
//             function: layer.method,
//             route: routePath,
//             //regexp: layer.regexp,
//             line:-1
//         }
//         console.log('%s %s', layer.method, routePath);
//     }
//   }

// export function discover(app: express.Application){
//     for(let l of app._router.stack){
//         iterate([],l);
//     }
// }

function setSemanticAttributesForRoute(span?: Span, routeDetails?: RouteDetails) {
    if(routeDetails) {
        span?.setAttribute(SemanticAttributes.CODE_FILEPATH, routeDetails.filePath);
        span?.setAttribute(SemanticAttributes.CODE_LINENO, routeDetails.line);
        span?.setAttribute(SemanticAttributes.CODE_FUNCTION, routeDetails.function);
    }
}

async function handleRoute(req, span: Span | undefined) {
    const route = req.baseUrl + req.route.path;
    let routeDetails = routesMap[route];
    if(routeDetails) {
        setSemanticAttributesForRoute(span, routeDetails);
    }
    else {
        const layer = req.route.stack[0];
        const location = await getFunctionLocation(layer.handle);
        console.log('location:', location);
        if (location) {
            routeDetails = {
                filePath: location.source,
                line: location.line,
                function: layer.name,
                route: route
            };
            routesMap[route] = routeDetails;
            setSemanticAttributesForRoute(span, routeDetails);
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

// export function useDigmaMiddleware(app: express.Application){
//     app.use( async (req, res, next) => {
//         const tracer = trace.getTracerProvider().getTracer(name);
//         return await tracer.startActiveSpan('middleware - digma', async span=>{
//             try{
//                 return next();
//             }
//             catch(e){
//                 throw e;
//             }
//             finally{
//                 const route = req.baseUrl + req.route.path;
//                 let routeDetails = routesMap[route];
//                 if(!routeDetails){
//                     const layer = req.route.stack[0];
//                     const location =  await getFunctionLocation(layer.handle);
//                     if(location){
//                         routesMap[route] = {
//                             filePath: location.source,
//                             line: location.line,
//                             function: layer.name,
//                             route: route
//                         }
//                     }
//                 }
//                 routeDetails = routesMap[route]
//                 if(routeDetails){
//                     span.setAttribute(SemanticAttributes.CODE_FILEPATH, routeDetails.filePath);
//                     span.setAttribute(SemanticAttributes.CODE_LINENO, routeDetails.line);
//                     span.setAttribute(SemanticAttributes.CODE_FUNCTION, routeDetails.function);
//                 }
//                 span.end();
//             }

//         });
//        });

// router.use(async function (req, res, next) {
//     // let rootSpan = trace.getSpan(context.active());
//     // if(rootSpan){
//     //     rootSpan.setAttribute("test", "asd");
//     // }
//     const tracer = trace.getTracerProvider().getTracer("DIGMAAAA");
//     await tracer.startActiveSpan("source code",async span=>{
//         next();
//         const route = req.baseUrl + req.route.path;
//         let routeDetails = routesMap[route];
//         if(!routeDetails){
//             const layer = req.route.stack[0];
//             const location =  await getFunctionLocation(layer.handle);
//             console.log("location:", location);
//             if(location){
//                 routesMap[route] = {
//                     filePath: location.source,
//                     line: location.line,
//                     function: layer.name,
//                     regexp: "",
//                     route: route
//                 }
//             }
//         }
//         routeDetails = routesMap[route]
//         if(routeDetails){
//             span.setAttribute(SemanticAttributes.CODE_FILEPATH, routeDetails.filePath);
//             span.setAttribute(SemanticAttributes.CODE_LINENO, routeDetails.line);
//             span.setAttribute(SemanticAttributes.CODE_FUNCTION, routeDetails.function);
//         }
//         span.end();
//     });
// })
