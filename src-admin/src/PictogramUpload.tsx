import React from "react";
import UploadIcon from "@mui/icons-material/Upload";
import { Box, Button, Typography } from "@mui/material";
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from "@iobroker/json-config";

interface UploadResult {
	ok?: boolean;
	path?: string;
	error?: string;
	message?: string;
}

interface PictogramUploadState extends ConfigGenericState {
	uploading: boolean;
	error: string;
}

function text(language: string | undefined, de: string, en: string): string {
	return language === "de" ? de : en;
}

export default class PictogramUpload extends ConfigGeneric<ConfigGenericProps, PictogramUploadState> {
	private fileInputRef = React.createRef<HTMLInputElement>();

	constructor(props: ConfigGenericProps) {
		super(props);
		this.state = {
			...this.state,
			uploading: false,
			error: "",
		};
	}

	private handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) {
			return;
		}

		const lang = this.props.oContext.language;
		if (!this.props.alive) {
			this.setState({
				error: text(lang, "Adapter-Instanz zuerst starten.", "Start the adapter instance first."),
			});
			return;
		}
		if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)) {
			this.setState({
				error: text(lang, "Nur PNG/JPEG/GIF/WebP/SVG erlaubt.", "Only PNG/JPEG/GIF/WebP/SVG allowed."),
			});
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			this.setState({
				error: text(lang, "Datei zu gross (max. 5 MB).", "File too large (max 5 MB)."),
			});
			return;
		}

		this.setState({ uploading: true, error: "" });
		const reader = new FileReader();
		reader.onload = () => {
			this.props.oContext.socket.sendTo(
				this.props.oContext.instance,
				"uploadPictogram",
				{
					filename: file.name,
					base64: String(reader.result || ""),
					mime: file.type,
				},
				(result: UploadResult) => {
					if (result?.ok && result.path) {
						this.onChange(this.props.attr!, result.path);
						this.setState({ uploading: false, error: "" });
						return;
					}
					this.setState({
						uploading: false,
						error:
							result?.error || result?.message || text(lang, "Upload fehlgeschlagen.", "Upload failed."),
					});
				},
			);
		};
		reader.onerror = () => {
			this.setState({
				uploading: false,
				error: text(lang, "Upload fehlgeschlagen.", "Upload failed."),
			});
		};
		reader.readAsDataURL(file);
	};

	renderItem(_error: string, disabled: boolean): React.JSX.Element {
		const lang = this.props.oContext.language;
		const path = String(ConfigGeneric.getValue(this.props.data, this.props.attr!) || "");

		return (
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
				<input
					ref={this.fileInputRef}
					type="file"
					accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
					style={{ display: "none" }}
					onChange={this.handleFileChange}
				/>
				<Button
					variant="contained"
					startIcon={<UploadIcon />}
					disabled={disabled || this.state.uploading || !this.props.alive}
					onClick={() => this.fileInputRef.current?.click()}
				>
					{this.state.uploading
						? text(lang, "Wird hochgeladen…", "Uploading…")
						: text(lang, "Bild vom Computer hochladen", "Upload image from computer")}
				</Button>
				{path ? (
					<Typography variant="body2">
						{text(lang, "Gespeichert unter:", "Saved as:")} {path}
					</Typography>
				) : null}
				{this.state.error ? (
					<Typography
						variant="body2"
						color="error"
					>
						{this.state.error}
					</Typography>
				) : null}
				{!this.props.alive ? (
					<Typography
						variant="body2"
						color="warning.main"
					>
						{text(lang, "Adapter-Instanz zuerst starten.", "Start the adapter instance first.")}
					</Typography>
				) : null}
			</Box>
		);
	}
}
