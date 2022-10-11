# Opentelemetry Node.js Instrumentation For express

This instrumentation package for express provides Digma with span attributes required to effectively
glean code object based insights for continuous feedback and display them in the IDE. The library adds
additional attributes to the OTEL resource attributes.

provided on top of the [@opentelemetry/instrumentation-express](https://www.npmjs.com/package/@opentelemetry/instrumentation-express) package. 


## Prerequisites
*  Node version: `8 or above`
*  [@opentelemetry/instrumentation-express](https://www.npmjs.com/package/@opentelemetry/instrumentation-express) package
*  [@opentelemetry/instrumentation-http](https://www.npmjs.com/package/@opentelemetry/instrumentation-http) package

## Getting Started

1. Install the package.

    ```sh
    npm install @digma/instrumentation-express
    ```

2. Install the prerequisite OpenTelemetry express and http instrumentation packages.

    ```sh
    npm install @opentelemetry/instrumentation-express
    npm install @opentelemetry/instrumentation-http
    ```

    Alternatively, install the opentelemetry auto-instrumentation package for Node.js, which
    automatically imports both the express and http packages.

    ```sh
    npm install @opentelemetry/auto-instrumentations-node
    ```

3. Connect the Digma instrumentation to the OpenTelemetry SDK. Locate the code that initalizes the OpenTelemetry SDK. This is typically in a file named tracing.js or tracing.ts. Call the `applyDigmaInstrumentation()` method before before calling `sdk.start()`.

    ```js
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { applyDigmaInstrumentation } = require('@digma/instrumentation-express');

    const sdk = new NodeSDK({/* ... */});

    applyDigmaInstrumentation(sdk);

    sdk.start();
    ```

4. Add the Digma express middleware.

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

However, the middleware can be added to an individual router instead of the main app:

```js
const express = require('express');
const { digmaRouteHandler } = require('@digma/instrumentation-express');

const router = express.Router();

router.use(digmaRouteHandler);

router.get('/', (req, res) => { /* ... */ });
```

Avoid adding the middleware to *both* the main app and individual routers. Although this will not produce duplicate spans, it will cause each route in the router to be processed twice and will affect performance.

## Handling Exceptions

It is considered a best practice to catch exceptions, report them to OpenTelemetry, and properly
close the spans:

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

However, there may be circumstances in which this pattern is irrelevant or cannot be applied. When thrown errors are not handled properly, this has two important ramifications:
1. Some of the spans will not be closed automatically, likely producing orphaned spans (child spans whose parents are missing in the trace) and spans with incomplete or inaccurate data.
2. The errors will not be reported.

The Digma express instrumentation provides an option to capture uncaught exceptions.
In the tracing.js file, enable the `` option when calling `applyDigmaInstrumentation`:

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
