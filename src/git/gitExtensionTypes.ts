import * as vscode from 'vscode';

/**
 * VS Code Git Extension API types
 * Based on the official VS Code git extension API
 */

export interface GitExtension {
	readonly enabled: boolean;
	readonly onDidChangeEnablement: vscode.Event<boolean>;
	getAPI(version: 1): API;
}

export interface API {
	readonly repositories: Repository[];
	readonly onDidOpenRepository: vscode.Event<Repository>;
	readonly onDidCloseRepository: vscode.Event<Repository>;
}

export interface Repository {
	readonly rootUri: vscode.Uri;
	readonly state: RepositoryState;
	readonly onDidChangeRepository: vscode.Event<void>;
}

export interface RepositoryState {
	readonly HEAD: Branch | undefined;
	readonly refs: Ref[];
	readonly remotes: Remote[];
	readonly submodules: Submodule[];
	readonly rebaseCommit: Commit | undefined;
	readonly mergeChanges: Change[];
	readonly indexChanges: Change[];
	readonly workingTreeChanges: Change[];
	readonly onDidChange: vscode.Event<void>;
}

export interface Branch {
	readonly type: RefType.Head;
	readonly name?: string;
	readonly commit?: string;
	readonly upstream?: UpstreamRef;
	readonly ahead?: number;
	readonly behind?: number;
}

export interface Ref {
	readonly type: RefType;
	readonly name?: string;
	readonly commit?: string;
	readonly remote?: string;
}

export interface UpstreamRef {
	readonly remote: string;
	readonly name: string;
}

export interface Remote {
	readonly name: string;
	readonly fetchUrl?: string;
	readonly pushUrl?: string;
	readonly isReadOnly: boolean;
}

export interface Submodule {
	readonly name: string;
	readonly path: string;
	readonly url: string;
}

export interface Commit {
	readonly hash: string;
	readonly message: string;
	readonly parents: string[];
	readonly authorDate?: Date;
	readonly authorName?: string;
	readonly authorEmail?: string;
	readonly commitDate?: Date;
}

export interface Change {
	readonly uri: vscode.Uri;
	readonly originalUri: vscode.Uri;
	readonly renameUri?: vscode.Uri;
	readonly status: Status;
}

export enum RefType {
	Head,
	RemoteHead,
	Tag
}

export enum Status {
	INDEX_MODIFIED,
	INDEX_ADDED,
	INDEX_DELETED,
	INDEX_RENAMED,
	INDEX_COPIED,
	MODIFIED,
	DELETED,
	UNTRACKED,
	IGNORED,
	INTENT_TO_ADD,
	BOTH_DELETED,
	ADDED_BY_US,
	DELETED_BY_THEM,
	ADDED_BY_THEM,
	DELETED_BY_US,
	BOTH_ADDED,
	BOTH_MODIFIED
} 