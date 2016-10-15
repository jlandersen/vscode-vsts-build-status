"use strict";

import {workspace, WorkspaceConfiguration, Memento, Disposable} from "vscode"
import {BuildDefinition} from "./vstsbuildrestclient"
import * as vsts from "vso-node-api/WebApi";
import {IRequestHandler} from "vso-node-api/interfaces/common/VsoBaseInterfaces"
import {BuildDefinitionReference} from 'vso-node-api/interfaces/BuildInterfaces';

export interface Settings {
    account: string;
    username: string;
    password: string;
    project: string;
    activeBuildDefinition: BuildDefinitionReference;
    onDidChangeSettings(handler: () => void): void;
    getConnection(): vsts.WebApi;

    dispose(): void;
    isValid(): boolean;
}

export class WorkspaceVstsSettings implements Settings {
    account: string;
    username: string;
    password: string;
    project: string;

    private _activeBuildDefinition: BuildDefinitionReference;
    private activeBuildDefinitionStateKey: string = "vsts.active.definition";
    private state: Memento;
    private workspaceSettingsChangedDisposable: Disposable;
    private onDidChangeSettingsHandler: () => any;

    constructor(state: Memento) {
        this.state = state;

        var definition = state.get<BuildDefinitionReference>(this.activeBuildDefinitionStateKey);
        if (definition) {
            this.activeBuildDefinition = definition;
        }

        this.workspaceSettingsChangedDisposable = workspace.onDidChangeConfiguration(() => {
            this.reload();

            if (this.onDidChangeSettingsHandler) {
                this.onDidChangeSettingsHandler();
            }
        });

        this.reload();
    }
    
    get activeBuildDefinition(): BuildDefinitionReference {
        return this._activeBuildDefinition;
    }

    set activeBuildDefinition(definition: BuildDefinitionReference) {
        this._activeBuildDefinition = definition;
        this.state.update(this.activeBuildDefinitionStateKey, definition);
    }

    public onDidChangeSettings(handler: () => any): void {
        this.onDidChangeSettingsHandler = handler;
    }

    public getConnection(): vsts.WebApi {
        if (!this.isValid()) {
            return null;
        }
        
        let collectionUrl = `https://${this.account}.visualstudio.com/DefaultCollection/`;
        let authHandler: IRequestHandler;

        if (this.username) {
            authHandler = vsts.getBasicHandler(this.username, this.password);
        } else {
            authHandler = vsts.getPersonalAccessTokenHandler(this.password);
        }

        return new vsts.WebApi(collectionUrl, authHandler);
    }

    public isValid(): boolean {
        return this.isAccountProvided() && this.isCredentialsProvided() && this.isProjectSpecified();
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

    private reload() {
        var configuration = workspace.getConfiguration("vsts");

        this.account = configuration.get<string>("account").trim();
        this.username = configuration.get<string>("username").trim();
        this.password = configuration.get<string>("password").trim();
        this.project = configuration.get<string>("project").trim();
    }
}