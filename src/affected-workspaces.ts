import { readdirSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import minimatch from 'minimatch';
import { getYarnWorkspacesInfo, YarnWorkspacesInfo, isWorkspaceExist } from './yarn-workspaces';

export const getAffectedWorkspaces = (workspaces: string[], defaultWorkspaces: string[], filterPattern: string = '**') => {
  const affectedProjectsFromDirectories = getAffectedFromDirectories(workspaces);

  const defaultWorkspaceList = (defaultWorkspaces || workspaces).reduce(
    (acc: string[], directory: string) => [...acc, ...getProjectsByDirectory(directory)],
    [],
  );

  const affectedProjects = affectedProjectsFromDirectories.length
    ? affectedProjectsFromDirectories
    : defaultWorkspaceList;

  const filter = makeFilter(filterPattern);
  const filteredAffectedProjects = affectedProjects.filter(filter);
  return pack(filteredAffectedProjects);
};

const getProjectsByDirectory = (source: string): string[] =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `${source}/${dirent.name}`);

const getGitOutput = (): string => {
  // corner case when PR be to another branch
  const cmd = 'git diff origin/main --numstat';
  return execSync(cmd).toString();
};

type Change = {
  path: string;
};
const parseGitOutput = (gitOutput: string): Change[] =>
  gitOutput
    .split('\n')
    .filter(line => line)
    .map(diffChage => diffChage.split('\t'))
    // eslint-disable-next-line no-unused-vars
    .map(([_, __, path]) => ({
      path,
    }));

const getLocation = (change: Change) => {
  const [dir, project] = change.path.split('/');
  return [dir, project].join('/');
};

const isApp = (projectName: string) => minimatch(projectName, 'app/**');
const isNoApp = (projectName: string) => !isApp(projectName);

const splitByChunk = (array: string[], chunkCount: number = 10) => {
  return array.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / chunkCount);

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [];
    }

    resultArray[chunkIndex].push(item);

    return resultArray;
  }, [] as string[][]);
};

const getChunkCount = (affectedProjects: string[]) => {
  if (affectedProjects.length < 3) return affectedProjects.length;

  return affectedProjects.length > 10 ? Math.ceil(affectedProjects.length / 2) : 10;
};

const getProjectName = (projectName: string) => {
  try {
    const json = JSON.parse(readFileSync(`${projectName}/package.json`, 'utf8'));
    return json.name;
    // eslint-disable-next-line no-empty
  } catch (e) {}

  return undefined;
};

const pack = (affectedProjects: string[]) => {
  const apps = affectedProjects
    .filter(isApp)
    .map(getProjectName)
    .filter(Boolean)
    .map(projectName => ({ name: projectName, projects: [projectName] }));

  const chunkCount = getChunkCount(affectedProjects);
  const noApps = affectedProjects
    .filter(isNoApp)
    .map(getProjectName)
    .filter(Boolean);

  return [
    ...apps,
    ...splitByChunk(noApps, chunkCount).map((arr, index) => ({
      name: arr.length === 1 ? arr[0] : `Project pack: ${index}`,
      projects: arr.sort(),
    })),
  ];
};

const unique = <T>(value: T, index: number, arr: T[]) => arr.indexOf(value) === index;

const getAffectedDependencyGraph = (
  workspacesInfo: YarnWorkspacesInfo,
  projectName: string,
): string[] => {
  const dependencies = Object.entries(workspacesInfo).reduce(
    (acc: string[], [name, info]) =>
      info.workspaceDependencies.includes(projectName) ? [...acc, name] : acc,
    [],
  );

  if (dependencies.length) {
    return dependencies.reduce(
      (acc, dependency) => [...acc, ...getAffectedDependencyGraph(workspacesInfo, dependency)],
      [projectName],
    );
  }

  return [projectName];
};

const getLocationByProjectName = (projectName: string, workspacesInfo: YarnWorkspacesInfo) =>
  workspacesInfo[projectName].location;

const isRename = (path: Change['path']) => path.includes('=>');
const formatForRename = (path: Change['path']) => {
  if (!isRename(path)) {
    return path;
  }

  type Match = string[] & {
    groups?: Record<string, string>,
    index?: number,
  } | null;
  const match: Match = path.match(/(?<path>.*){(?<oldName>.*)\s=>\s(?<newName>.*)}/);
  if (!match || match.index === undefined || !match?.groups || match?.index < 0 || Object.keys(match?.groups).length !== 3) {
    return path;
  }
  return `${match.groups.path}${match.groups.newName.trim()}`;
};

const format = (change: Change) => ({
  ...change,
  path: formatForRename(change.path),
});

const getAffectedFromDirectories = (directories: string[]) => {
  const patterns = directories.map(dir => `${dir}/**/*`);

  const changes = parseGitOutput(getGitOutput());
  const workspacesInfo = getYarnWorkspacesInfo();

  return changes
    .map(format)
    .filter(change => patterns.some(pattern => minimatch(change.path, pattern)))
    .map(getLocation)
    .map(getProjectName)
    .reduce(
      (acc, projectName) => [...acc, ...getAffectedDependencyGraph(workspacesInfo, projectName)],
      [],
    )
    .filter((projectName: string) => isWorkspaceExist(workspacesInfo, projectName))
    .map((projectName: string) => getLocationByProjectName(projectName, workspacesInfo))
    .filter(unique);
};

const makeFilter = (pattern: string) => (projectName: string) => minimatch(projectName, pattern);
