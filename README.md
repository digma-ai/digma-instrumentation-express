# Opentelemetry Node.js Instrumentation For express

This package provides instrumentation for additional span attributes provided on top of the [@opentelemetry/instrumentation-express](https://www.npmjs.com/package/@opentelemetry/instrumentation-express) package. 

In order to be able to effectively glean code-object based insights for continuous feedback and map them back in the IDE, Digma inserts additional attribute into the OTEL resource attributes. 

## Pre-requisites
*  Node  `version: 8 or above.`
*  [@opentelemetry/instrumentation-express](https://www.npmjs.com/package/@opentelemetry/instrumentation-express) package

## Installing the module
```
npm install --save @digma/instrumentation-express
```

### Instrumenting your express project

The Digma instrumentation depends on the express opentelemetry instrumentation.

```javascript
const { digmaRouteHandler } = require('@digma/instrumentation-express');

app = express();
app.use(digmaRouteHandler);
app.use('/users', users); // some router example
```


### Additional span attributes added by this instrumentation

Span attributes: `code.filepath` 
, `code.function` ,`code.lineno`, `digma.http.route`