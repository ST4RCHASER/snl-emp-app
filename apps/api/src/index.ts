import { app } from "./app.js";

const port = process.env.PORT || 3000;

app.listen(port);

console.log(
  `🦊 SNL Employee API is running at http://localhost:${port}`
);
console.log(`📚 Swagger docs at http://localhost:${port}/swagger`);
