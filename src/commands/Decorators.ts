import {window} from "vscode";
import {getDefaultSettings} from "../Settings";
import {isHttpResponseError} from "../VstsRestClient";

function errorHandler(error: any) {
    if (!error) {
        return;
    }

    if (isHttpResponseError(error) && error.isUnauthorizedError()) {
        window.showErrorMessage("Received unauthorized response. Check credentials have permissions to perform the required action.");
        return;
    }

    // No internet access (or VSTS is completely down)
    if (error.code && error.code === "ENOTFOUND") {
        window.showErrorMessage("Unable to connect to VSTS. Please check Internet connection.");
        return;
    }

    // Bad VSTS credentials usually cause invalid-json errors with fetch
    // (should not be confused with unauthorized - this happens when credentials do not exist)
    if (error.type && error.type === "invalid-json") {
        window.showErrorMessage("Received a bad response from VSTS. Check credentials are properly configured.");
        return;
    }

   window.showErrorMessage("Unexpected error occurred. Please check your Internet connection and your settings are properly configured.");
}

export function handleError(target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
        let result = <Promise<any>>originalMethod.apply(this, args);
        result = result.catch(errorHandler);

        return result;
    };

    return descriptor;
}

export function validateSettings(target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
        if (!getDefaultSettings().isValid()) {
            window.showInformationMessage("Account, project and password/Personal Access Token must be provided in user or workspace settings.");
            return;
        }

        let result = originalMethod.apply(this, args);

        return result;
    };

    return descriptor;
}