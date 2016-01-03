import {workspace, WorkspaceConfiguration} from 'vscode'
import fs = require('fs')

export class Settings {
    account: string;
    username: string;
    password: string;
    project: string;
    
    constructor(account: string, username: string, password: string, project: string) {
        this.account = account;
        this.username = username;
        this.password = password;
        this.project = project;
    }
    
    public static createFromWorkspaceConfiguration(configuration: WorkspaceConfiguration) {
        return new Settings(
            configuration.get<string>("account").trim(), 
            configuration.get<string>("username").trim(),
            configuration.get<string>("password").trim(),
            configuration.get<string>("project").trim());
    }
    
    public isValid() {
        return this.isAccountProvided() && this.isCredentialsProvided() && this.isProjectSpecified();
    }
    
    public isAccountProvided(): boolean {
        if (this.account) {
            return true;
        }
        
        return false;
    }
    
    public isCredentialsProvided(): boolean {
        if (this.password) {
            return true;
        }
        
        return false;
    }
    
    public isProjectSpecified(): boolean {
        if (this.project) {
            return true;
        }
        
        return false;                
    }
}