"use strict";

import {workspace, WorkspaceConfiguration, Memento, Disposable} from "vscode"
import {BuildDefinition} from "./vstsbuildrestclient"

export interface Settings {
    account: string;
    username: string;
    password: string;
    project: string;
    activeBuildDefinitions: BuildDefinition[];
    definitionsGroup?: BuildDefinition[];
    definitionsGroupName?: string;
    onDidChangeSettings(handler: () => void): void;

    dispose(): void;
    isValid(): boolean;
}

export class WorkspaceVstsSettings implements Settings {
    account: string;
    username: string;
    password: string;
    project: string;
    definitionsGroup?: BuildDefinition[];
    definitionsGroupName?: string;

    private _activeBuildDefinitions: BuildDefinition[] = [];
    private activeBuildDefinitionsStateKey: string = "vsts.active.definitions";
    private state: Memento;
    private workspaceSettingsChangedDisposable: Disposable;
    private onDidChangeSettingsHandler: () => any;

    constructor(state: Memento) {
        this.state = state;

        var definitions = state.get<BuildDefinition[]>(this.activeBuildDefinitionsStateKey);
        if (definitions) {
            this.activeBuildDefinitions = definitions;
        }

        this.workspaceSettingsChangedDisposable = workspace.onDidChangeConfiguration(() => {
            this.reload();

            if (this.onDidChangeSettingsHandler) {
                this.onDidChangeSettingsHandler();
            }
        });

        this.reload();
    }
    
    get activeBuildDefinitions(): BuildDefinition[] {
        return this._activeBuildDefinitions;
    }

    set activeBuildDefinitions(definitions: BuildDefinition[]) {
        this._activeBuildDefinitions = definitions;
        this.state.update(this.activeBuildDefinitionsStateKey, definitions);
    }

    public onDidChangeSettings(handler: () => any): void {
        this.onDidChangeSettingsHandler = handler;
    }

    public isValid(): boolean {
        return this.isAccountProvided() && this.isCredentialsProvided() && this.isProjectSpecified() && this.isBuildDefinitionsNameSpecified();
    }

    public dispose(): void {
        if (this.workspaceSettingsChangedDisposable) {
            this.workspaceSettingsChangedDisposable.dispose();
        }
    }

    private isAccountProvided(): boolean {
        if (this.account) {
            return true;
        }

        return false;
    }

    private isCredentialsProvided(): boolean {
        if (this.password) {
            return true;
        }

        return false;
    }

    private isProjectSpecified(): boolean {
        if (this.project) {
            return true;
        }

        return false;
    }

    private isBuildDefinitionsNameSpecified(): boolean {
        if (this.definitionsGroup && !this.definitionsGroupName) {
            return false;
        }

        return true;
    }

    private reload() {
        var configuration = workspace.getConfiguration("vsts");

        this.account = configuration.get<string>("account").trim();
        this.username = configuration.get<string>("username").trim();
        this.password = configuration.get<string>("password").trim();
        this.project = configuration.get<string>("project").trim();

        const definitionsGroup = configuration.get<string>("definitionsGroup").trim();
        this.definitionsGroupName = configuration.get<string>("definitionsGroupName").trim();
        
        if (definitionsGroup) {
            const buildIds = definitionsGroup.split(',').map(id => parseInt(id));
            let defList: BuildDefinition[] = [];
            buildIds.forEach(id => {
                defList.push({
                    id: id,
                    name: this.definitionsGroupName,
                    revision: undefined
                });
            });
            this.definitionsGroup = defList;            
            this.activeBuildDefinitions = defList;
        }
    }
}