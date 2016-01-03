## Visual Studio Team Services Build Extension for Visual Studio Code
Check the status of your Visual Studio Team Services builds directly in Visual Studio Code!
Select a build definition to monitor, and a status indicator will be visible in the status bar.

![Screenshot-1](assets/vscode-selection.png)

![Screenshot-2](assets/vscode-status.png)

A selected build definition in a specific workspace will be selected automatically the next time you open that workspace.

## Configuration
The extension is enabled by providing the following settings:

```json
{
    "vsts.username": "..", // alternate credentials name (leave out if you use Personal Access Token)
    "vsts.password": "..", // alternate credentials password or Personal Access Token
    "vsts.account": "account", // from account.visualstudio.com
    "vsts.project": "WebApp" // project name to find build definitions in
}
```

## License
MIT, please see LICENSE for details. Copyright (c) 2016 Jeppe Andersen.