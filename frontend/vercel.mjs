import { createDeploymentConfig } from './deploymentConfig.js';

// Build-time configuration; no backend credentials are embedded in the browser bundle.
export const config = createDeploymentConfig(process.env);
