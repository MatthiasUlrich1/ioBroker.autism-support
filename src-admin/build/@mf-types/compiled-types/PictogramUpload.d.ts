import React from "react";
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from "@iobroker/json-config";
interface PictogramUploadState extends ConfigGenericState {
    uploading: boolean;
    error: string;
}
export default class PictogramUpload extends ConfigGeneric<ConfigGenericProps, PictogramUploadState> {
    private fileInputRef;
    constructor(props: ConfigGenericProps);
    private handleFileChange;
    renderItem(_error: string, disabled: boolean): React.JSX.Element;
}
export {};
