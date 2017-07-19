import {window} from "vscode";
import * as openurl from "openurl";
import {VstsRestClient} from "../VstsRestClient";
import {Settings} from "../Settings";
import {BuildQuickPicker} from "../components/BuildQuickPicker";
import {validateSettings, handleError} from "./Decorators";

export default class OpenBuildInBrowserCommand {
    private buildQuickPicker: BuildQuickPicker;
    constructor(private settings: Settings, private restClient: VstsRestClient) {
        this.buildQuickPicker = new BuildQuickPicker(settings, restClient);
    }

    @validateSettings
    @handleError
    public execute(): Promise<any> {
        return this.buildQuickPicker.showBuildDefinitionQuickPick("Select a build definition")
            .then(definition => {
                if (!definition) {
                    return;
                }

                if (definition.length > 1) {
                    window.showInformationMessage(`Group build definition cannot be opened, please select single one instead.`);
                }

                return this.buildQuickPicker.showBuildQuickPick(definition[0].id, "Select a build to open in browser");
            })
            .then(build => {
                if (!build) {
                    return;
                }

                openurl.open(build._links.web.href);
            });
    }
}