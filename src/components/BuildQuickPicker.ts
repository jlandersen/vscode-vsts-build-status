import { window } from "vscode";
import { Build, BuildDefinition, VstsRestClient } from "../VstsRestClient";
import { Settings } from "../Settings";

interface BuildDefinitionQuickPickItem {
    ids: number[];
    label: string;
    description: string;
    definitions: BuildDefinition[];
}

interface BuildQuickPickItem {
    id: number;
    label: string;
    description: string;
    build: Build;
}

export class BuildQuickPicker {
    constructor(private settings: Settings, private restClient: VstsRestClient) {
    }

    private mapBuildDefinitionsToPickItems(buildDefinitions: BuildDefinition[]) {
        let definitionPickItems: BuildDefinitionQuickPickItem[] = buildDefinitions
            .map(definition => {
                return {
                    label: definition.name,
                    description: `Revision ${definition.revision}`,
                    ids: [definition.id],
                    definitions: [definition]
                }
            });

        if (this.settings.definitionsGroup) {
            definitionPickItems.push({
                label: this.settings.definitionsGroupName ?
                    this.settings.definitionsGroupName :
                    this.settings.definitionsGroup.map(b => b.id.toString()).join(','),
                description: 'Grouped Build Definition',
                ids: this.settings.definitionsGroup.map(b => b.id),
                definitions: this.settings.definitionsGroup
            });
        }

        return definitionPickItems;
    }

    private mapBuildsToPickItems(builds: Build[]): BuildQuickPickItem[] {
        return builds.map(build => {
            return {
                label: new Date(build.queueTime).toLocaleString(),
                description: build.result,
                id: build.id,
                build: build
            };
        });
    }

    public showBuildDefinitionQuickPick(placeHolder: string): Promise<BuildDefinition[]> {
        let request = this.restClient.getDefinitions()
            .then(response => this.mapBuildDefinitionsToPickItems(response.value))
            .then(pickItems => {
                let options = {
                    placeHolder: placeHolder
                };

                return window.showQuickPick(pickItems, options);
            })
            .then(result => {
                if (!result) {
                    return null;
                }

                return result.definitions;
            });

        return request;
    }

    public showBuildQuickPick(buildDefinitionId: number, placeHolder: string): Promise<Build> {
        let request = this.restClient.getBuilds([buildDefinitionId], 10)
            .then(builds => this.mapBuildsToPickItems(builds.value))
            .then(pickItems => {
                let options = {
                    placeHolder: placeHolder
                };

                return window.showQuickPick(pickItems, options);
            })
            .then(result => {
                if (!result) {
                    return null;
                }

                return result.build;
            });

        return request;
    }
}