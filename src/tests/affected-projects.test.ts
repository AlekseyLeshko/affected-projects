import { execSync } from 'child_process';
import fs from 'fs';
import { getAffectedWorkspaces } from '../index';
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
      jest.spyOn(fs, 'readdirSync').mockReturnValueOnce([]);
      jest.spyOn(fs, 'readFileSync').mockImplementation(mockReadFileSync);

      const gitDiffOutput = generateGitDiffOutput(changes);
      const yarnWorkspaceInfo = makeYarnWorkspacesLog(yarnDependencies);
      (execSync as jest.Mock)
        .mockImplementationOnce(() => gitDiffOutput)
        .mockImplementationOnce(() => JSON.stringify(yarnWorkspaceInfo));

      const actual = getAffectedWorkspaces(directories, defaultProjects, filterPattern);

      // Asserts
      expect(execSync).toHaveBeenCalledTimes(2);

      expect(actual).toEqual(expected);
    },
  );

  it.each([
    [
      'return library-b workspace when library-a was renamed to library-b',
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: 0,
            deletions: 0,
            path: 'library/{library-a => library-b}/package.json',
          },
        ],
        yarnDependencies: {
          '@org/library-b': {
            location: 'library/library-b',
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
        },
        expected: [
          {
            name: '@org/library-b',
            projects: ['@org/library-b'],
          },
        ],
      },
    ],
    [
      'return library-b workspace when library-a was renamed to library-b and add one new file',
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: 0,
            deletions: 0,
            path: 'library/{library-a => library-b}/package.json',
          },
          {
            insertions: 10,
            deletions: 0,
            path: 'library/library-b/file.js',
          },
        ],
        yarnDependencies: {
          '@org/library-a': {
            location: 'library/library-a',
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
          '@org/library-b': {
            location: 'library/library-b',
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
        },
        expected: [
          {
            name: '@org/library-b',
            projects: ['@org/library-b'],
          },
        ],
      },
    ],
    [
      'return library-a workspace when library-a and library-b were touched',
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: 10,
            deletions: 0,
            path: 'library/library-a/file.js',
          },
          {
            insertions: 0,
            deletions: 10,
            path: 'library/library-b/package.json',
          },
        ],
        yarnDependencies: {
          '@org/library-a': {
            location: 'library/library-a',
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
          '@org/library-b': {
            location: 'library/library-b',
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
        },
        expected: [
          {
            name: 'Project pack: 0',
            projects: ['@org/library-a', '@org/library-b'],
          },
        ],
      },
    ],
    [
      'return library-a workspace when a binary file was renamed from library-a',
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: '-',
            deletions: '-',
            path: 'library/library-b/icon.png',
          },
        ],
        yarnDependencies: {
          '@org/library-a': {
            location: 'library/library-a',
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
          '@org/library-b': {
            location: 'library/library-b',
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
        },
        expected: [
          {
            name: '@org/library-b',
            projects: ['@org/library-b'],
          },
        ],
      },
    ],
  ])('should %s', (_, {
    directories,
    changes,
    yarnDependencies,
    expected,
  }) => {
    jest.spyOn(fs, 'readdirSync').mockReturnValueOnce([]);
    jest.spyOn(fs, 'readFileSync').mockImplementation(mockReadFileSync);

    const gitDiffOutput = generateGitDiffOutput(changes);
    const yarnWorkspaceInfo = makeYarnWorkspacesLog(yarnDependencies);
    (execSync as jest.Mock)
      .mockImplementationOnce(() => gitDiffOutput)
      .mockImplementationOnce(() => JSON.stringify(yarnWorkspaceInfo));

    const actual = getAffectedWorkspaces(directories, []);

    // Asserts
    expect(execSync).toHaveBeenCalledTimes(2);

    expect(actual).toEqual(expected);
  });

  it.each([
    [
      'return library-a workspace when library-a was touched and library-b was deleted',
      {
        directories: ['library', 'app'],
        changes: [
          {
            insertions: 10,
            deletions: 0,
            path: 'library/library-a/file.js',
          },
          {
            insertions: 0,
            deletions: 10,
            path: 'library/library-b/package.json',
          },
        ],
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
  ])('should %s', (_, {
    directories,
    changes,
    yarnDependencies,
    expected,
  }) => {
    jest.spyOn(fs, 'readdirSync').mockReturnValueOnce([]);
    jest.spyOn(fs, 'readFileSync').mockImplementation(mockReadFileSync);

    const gitDiffOutput = generateGitDiffOutput(changes);
    const yarnWorkspaceInfo = makeYarnWorkspacesLog(yarnDependencies);
    (execSync as jest.Mock)
      .mockImplementationOnce(() => gitDiffOutput)
      .mockImplementationOnce(() => JSON.stringify(yarnWorkspaceInfo));

    const actual = getAffectedWorkspaces(directories, []);

    // Asserts
    expect(execSync).toHaveBeenCalledTimes(2);

    expect(actual).toEqual(expected);
  });
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
