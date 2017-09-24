import {workspace, WorkspaceConfiguration, Memento, Disposable} from "vscode"
import {BuildDefinition} from "./VstsRestClient"

export interface Settings {
    account: string;
    username: string;
    password: string;
    project: string;
    telemetryEnabled: boolean;
    activeBuildDefinitions: BuildDefinition[];
    definitionsGroup?: BuildDefinition[];
    definitionsGroupName?: string;
    onDidChangeSettings(handler: () => void): void;

    dispose(): void;
    isValid(): boolean;
}

export class WorkspaceVstsSettings implements Settings {
    static instance: WorkspaceVstsSettings;

    account: string;
    username: string;
    password: string;
    project: string;
    telemetryEnabled: boolean;
    definitionsGroup?: BuildDefinition[];
    definitionsGroupName?: string;

    private _activeBuildDefinitions: BuildDefinition[] = [];
    private activeBuildDefinitionsStateKey: string = "vsts.active.definitions";
    private state: Memento;
    private workspaceSettingsChangedDisposable: Disposable;
    private onDidChangeSettingsHandlers: (() => void)[] = [];

    public constructor(state: Memento) {
        this.state = state;

        var definitions = state.get<BuildDefinition[]>(this.activeBuildDefinitionsStateKey);
        if (definitions) {
            this.activeBuildDefinitions = definitions;
        }

        this.workspaceSettingsChangedDisposable = workspace.onDidChangeConfiguration(() => {
            this.reload();

            for (let handler of this.onDidChangeSettingsHandlers) {
                handler();
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

        for (let handler of this.onDidChangeSettingsHandlers) {
            handler();
        }
    }

    public onDidChangeSettings(handler: () => void) {
        this.onDidChangeSettingsHandlers.push(handler);
    }

    public isValid(): boolean {
        return this.isAccountProvided() && this.isCredentialsProvided() && this.isProjectSpecified() && this.isBuildDefinitionsNameSpecified();
    }

    public static getInstance(state: Memento) {
        return WorkspaceVstsSettings.instance || (WorkspaceVstsSettings.instance = new WorkspaceVstsSettings(state));
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
        this.telemetryEnabled = configuration.get<boolean>("telemetryEnabled", true);

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

let settings: Settings = null;

export function createDefaultSettings(state: Memento): Settings {
    return settings = WorkspaceVstsSettings.getInstance(state);
}

export function getDefaultSettings(): Settings {
    if (!settings) {
        throw Error("No default settings created. Use createdDefaultSettings to register default settings.");
    }

    return settings;
}