# OpenTelemetry Node.js Instrumentation for Express

[Digma](https://digma.ai/) facilitates continuous feedback by gleaning valuable insights from your code and displaying them in the IDE as you code.

This [OpenTelemetry](https://opentelemetry.io/) instrumentation package for [Express](https://expressjs.com/) helps Digma analyze your code by adding a number of OTEL attributes to the spans.

## Prerequisites
* Node version: `8 or above`
* The [@opentelemetry/instrumentation-express](https://www.npmjs.com/package/@opentelemetry/instrumentation-express) package
* The [@opentelemetry/instrumentation-http](https://www.npmjs.com/package/@opentelemetry/instrumentation-http) package
* The [@digma/otel-js-instrumentation](https://www.npmjs.com/package/@digma/otel-js-instrumentation) package

## Installation

### Install the package.
```sh
npm install @digma/instrumentation-express
```

### Install the prerequisite packages.
```sh
npm install @opentelemetry/instrumentation-express
npm install @opentelemetry/instrumentation-http
npm install @digma/otel-js-instrumentation
```

Alternatively, install the opentelemetry auto-instrumentation package for Node.js, which
automatically imports both the express and http packages.

```sh
npm install @opentelemetry/auto-instrumentations-node
npm install @digma/otel-js-instrumentation
```

Note that the prerequisite packages are defined as peer dependencies.

## Usage

### Instrumenting your OpenTelemetry resource

Initialize the Node SDK.
Start by [setting up the Digma Node.js instrumentation](https://github.com/digma-ai/otel-js-instrumentation).
Then add the Digma Express instrumentation.

Your tracing.js file (or equivalent) should look something like this:

```js
// tracing.js

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { digmaAttributes } = require('@digma/otel-js-instrumentation');
const { applyDigmaExpressInstrumentation } = require('@digma/instrumentation-express');

const sdk = new NodeSDK({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'my-service', // process.env.SERVICE_NAME,
        ...digmaAttributes({
            rootPath: __dirname,
        }),
    }),
    /* ... */
});

applyDigmaExpressInstrumentation(sdk);

sdk.start();
```

### Add the Digma Express middleware to your app.

Digma uses a middleware to get accurate information about your Express routes.
For best results, add the middleware as early as possible in the pipeline.
It should be the first or one of the first middlewares, and must be added before any routes are declared.

```js   
const express = require('express');
const { digmaRouteHandler } = require('@digma/instrumentation-express');
const otelSdk = require('./tracing');

const app = express();

app.use(digmaRouteHandler);

app.get('/', (req, res) => { /* ... */ });
```

## Express Routers

We recommend adding the middleware only to the main app, as demonstrated in the **Getting Started** section above.
When the middleware is added to the app, it also handles all of the routers attached to the app.

The middleware can be added to an individual router instead of the main app:

```js
const express = require('express');
const { digmaRouteHandler } = require('@digma/instrumentation-express');

const router = express.Router();

router.use(digmaRouteHandler);

router.get('/', (req, res) => { /* ... */ });
```

Avoid adding the middleware to *both* the main app and individual routers. This will not produce duplicate spans but it will cause each route in the router to be processed twice and will affect performance.

## Handling Exceptions

It is considered a best practice to catch exceptions, report them to OpenTelemetry, and properly close the spans:

```js
async error(request, response) {
    await trace.startActiveSpan('error', async span => {
        try {
            // This statement will throw an error.
            errorfuncs.doAthing();

            // This code will never be reached.
            response.status(200).json({
                error: false,
                details: 'ok',
            });
        }
        catch (err) {
            // Report the error to OpenTelemetry.
            span.recordException(err);
            span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: err.message });

            // Send an appropriate response to the client.
            response.status(500).json({
                error: true,
                message: err.message,
            });
        }
        finally {
            // Close the span.
            span.end()
        }
    });
}
```

However, there may be circumstances in which this pattern is irrelevant or cannot be applied. When thrown errors are not properly caught, there can be two important ramifications:
1. Some of the spans will not be closed automatically, likely producing orphaned spans (child spans whose parents are missing in the trace) and spans with incomplete or inaccurate data.
2. The errors will not be reported.

The Digma express instrumentation provides an option to capture uncaught exceptions.
In the tracing.js file, enable the `handleUncaughtExceptions` option when calling `applyDigmaInstrumentation`:

```js
applyDigmaInstrumentation(sdk, {
    handleUncaughtExceptions: true,
});
```

When enabling this option, the instrumentation will handle the `uncaughtException` event.
- It will record the error.
- It will close the active span.
- If possible, it will also add the additional span attributes.

It will not swallow any errors, so the process will die after the span is closed if you do not add your own exception handler. The sole purpose of this option is to attempt to report the uncaught exception details and prevent the loss of these valuable traces.

## Span Attributes

This instrumentation adds the following span attributes to the root span:

- `code.filepath` 
- `code.function`
- `code.lineno`
- `digma.http.route`
