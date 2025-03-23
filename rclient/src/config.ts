// This file contains the configuration for the application.
// The configuration is loaded from environment variables.
// check what is the current enviroment and load the correct configuration
// The configuration is loaded from environment variables.

// The configuration is loaded from environment variables.
// check what is the current enviroment and load the correct configuration
// The configuration is loaded from environment variables.
const environment = process.env.REACT_APP_MYENV || "dev";
console.log("environment: ", environment);

const config = {
  apiDomain: getDefaultApiDomain(environment),
};

function getDefaultApiDomain(env: string): string {
  switch (env) {
    case "prod":
      return "https://api.yossidemo.click";
    case "dev":
      return "https://api.yossidemo.click";
    case "local":
      return "http://localhost:4000";
    default:
      return "https://api.yossidemo.click";
  }
}

export default config;
