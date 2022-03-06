import { execSync } from 'child_process';
import fs from 'fs';
import { getAffectedProjects } from '../index';
import { Change } from '../affected-projects.test.ts';
import { YarnWorkspacesInfo } from '../yarn-workspaces';

jest.mock('child_process');

jest.mock('fs');

const complexYarnWorkspaces = {
  '@org/library-a': {
    location: 'library/library-a',
    workspaceDependencies: [],
    mismatchedWorkspaceDependencies: [],
  },
  '@org/library-b': {
    location: 'library/library-b',
    workspaceDependencies: ['@org/library-c'],
    mismatchedWorkspaceDependencies: [],
  },
  '@org/library-c': {
    location: 'library/library-c',
    workspaceDependencies: ['@org/library-a'],
    mismatchedWorkspaceDependencies: [],
  },
  '@org/library-z': {
    location: 'library/library-z',
    workspaceDependencies: ['@org/library-a'],
    mismatchedWorkspaceDependencies: [],
  },
  '@org/library-u': {
    location: 'library/library-u',
    workspaceDependencies: [],
    mismatchedWorkspaceDependencies: [],
  },
  '@org/library-t': {
    location: 'library/library-f',
    workspaceDependencies: ['@org/library-u'],
    mismatchedWorkspaceDependencies: [],
  },
  '@org/app-x': {
    location: 'app/app-x',
    workspaceDependencies: ['@org/library-a', '@org/library-t'],
    mismatchedWorkspaceDependencies: [],
  },
};
describe('affected project', () => {
  beforeEach(() => {
    (execSync as jest.Mock).mockReset();
    (fs.readFileSync as jest.Mock).mockReset();
  });

  it.each([
    [
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: 7,
            deletions: 0,
            path: 'library/library-a',
          },
        ],
        defaultProjects: [],
        yarnDependencies: {
          '@org/library-a': {
            location: 'library/library-a',
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
        },
        expected: [
          {
            name: '@org/library-a',
            projects: ['@org/library-a'],
          },
        ],
      },
    ],
    [
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: 7,
            deletions: 0,
            path: 'library/library-a',
          },
        ],
        defaultProjects: [],
        yarnDependencies: complexYarnWorkspaces,
        expected: [
          {
            name: '@org/app-x',
            projects: ['@org/app-x'],
          },
          {
            name: 'Project pack: 0',
            projects: [
              '@org/library-a',
              '@org/library-b',
              '@org/library-c',
              '@org/library-z',
            ],
          },
        ],
      },
    ],
    [
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: 7,
            deletions: 0,
            path: 'library/library-a',
          },
        ],
        defaultProjects: [],
        yarnDependencies: complexYarnWorkspaces,
        filterPattern: 'library/**',
        expected: [
          {
            name: 'Project pack: 0',
            projects: [
              '@org/library-a',
              '@org/library-b',
              '@org/library-c',
              '@org/library-z',
            ],
          },
        ],
      },
    ],
    [
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: 7,
            deletions: 0,
            path: 'library/library-a',
          },
        ],
        defaultProjects: [],
        yarnDependencies: complexYarnWorkspaces,
        filterPattern: 'app/**',
        expected: [
          {
            name: '@org/app-x',
            projects: ['@org/app-x'],
          },
        ],
      },
    ],
  ])(
    'should return affected projects',
    ({ directories, defaultProjects, changes, yarnDependencies, filterPattern, expected }) => {
      jest.spyOn(fs, 'readFileSync').mockImplementation(mockReadFileSync);

      const gitDiffOutput = generateGitDiffOutput(changes);
      const yarnWorkspaceInfo = makeYarnWorkspacesLog(yarnDependencies);
      (execSync as jest.Mock)
        .mockImplementationOnce(() => gitDiffOutput)
        .mockImplementationOnce(() => JSON.stringify(yarnWorkspaceInfo));

      const actual = getAffectedProjects(directories, defaultProjects, filterPattern);

      // Asserts
      expect(execSync).toHaveBeenCalledTimes(2);

      expect(actual).toEqual(expected);
    },
  );
});

const generateGitDiffOutput = (changes: Change[] = []) =>
  changes.map(change => `${change.insertions}\t${change.deletions}\t${change.path}`).join('\n');

const mockReadFileSync = (string: string) => {
  const arr = (string as string).split('/');
  const name = `@org/${arr[1]}`;
  return JSON.stringify({ name });
}

const makeYarnWorkspacesLog = (yarnDependencies: YarnWorkspacesInfo[]) => ({
  type: 'log',
  data: JSON.stringify(yarnDependencies),
});
