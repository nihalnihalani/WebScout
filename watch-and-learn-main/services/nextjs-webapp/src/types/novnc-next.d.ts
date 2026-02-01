declare module 'novnc-next' {
  interface RFBOptions {
    credentials?: {
      password?: string;
      target?: string;
      username?: string;
    };
    shared?: boolean;
    repeaterID?: string;
    wsProtocols?: string[];
  }

  export default class RFB {
    constructor(
      target: HTMLElement,
      urlOrChannel: string | WebSocket,
      options?: RFBOptions
    );

    // Properties
    viewOnly: boolean;
    focusOnClick: boolean;
    clipViewport: boolean;
    dragViewport: boolean;
    scaleViewport: boolean;
    resizeSession: boolean;
    showDotCursor: boolean;
    background: string;
    qualityLevel: number;
    compressionLevel: number;
    capabilities: {
      power: boolean;
    };

    // Methods
    disconnect(): void;
    sendCredentials(credentials: { password?: string; target?: string; username?: string }): void;
    sendKey(keysym: number, code: string | null, down?: boolean): void;
    sendCtrlAltDel(): void;
    focus(): void;
    blur(): void;
    machineShutdown(): void;
    machineReboot(): void;
    machineReset(): void;
    clipboardPasteFrom(text: string): void;
    getImageData(): ImageData;
    toDataURL(type?: string, encoderOptions?: number): string;
    toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;

    // Events
    addEventListener(
      type: 'connect' | 'disconnect' | 'credentialsrequired' | 'securityfailure' | 'clipboard' | 'bell' | 'desktopname' | 'capabilities',
      listener: (e: CustomEvent) => void
    ): void;
    removeEventListener(
      type: string,
      listener: (e: CustomEvent) => void
    ): void;
  }
}
