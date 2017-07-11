import {VstsBuildRestClient} from "../vstsbuildrestclient";
import {Settings} from "../settings";
import {BuildQuickPicker} from "../components/BuildQuickPicker";

export default class SelectBuildDefinitionCommand {
    private buildQuickPicker: BuildQuickPicker;

    constructor(private settings: Settings, private restClient: VstsBuildRestClient) {
        this.buildQuickPicker = new BuildQuickPicker(settings, restClient);
    }

    public execute() {
        this.buildQuickPicker.showBuildDefinitionQuickPick("Select a build definition to monitor")
            .then(result => {
                if (result) {
                    this.settings.activeBuildDefinitions = result;
                }
            })
            .catch(error => {
                // Handle error
            });
    }
}