import { execSync } from 'child_process';

export type YarnWorkspaceInfo = {
  location: string;
  workspaceDependencies: string[];
  mismatchedWorkspaceDependencies: string[];
};

export type YarnWorkspacesInfo = Record<string, YarnWorkspaceInfo>;

export const getYarnWorkspacesInfo = () => {
  const cmd = 'yarn --json workspaces info';
  const yarnWorkspaceInfo = execSync(cmd).toString();
  const output = JSON.parse(yarnWorkspaceInfo);
  return JSON.parse(output.data);
};
