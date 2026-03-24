import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export function WindowControls() {
  return (
    <div className="flex items-center h-full">
      <button
        type="button"
        className="flex items-center justify-center w-[46px] h-full transition-colors hover:bg-muted text-foreground"
        onClick={() => appWindow.minimize()}
        title="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0H10V1H0V0Z" fill="currentColor"/>
        </svg>
      </button>
      <button
        type="button"
        className="flex items-center justify-center w-[46px] h-full transition-colors hover:bg-muted text-foreground"
        onClick={() => appWindow.toggleMaximize()}
        title="Maximize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M1 1H9V9H1V1ZM0 0V10H10V0H0Z" fill="currentColor"/>
        </svg>
      </button>
      <button
        type="button"
        className="flex items-center justify-center w-[46px] h-full transition-colors hover:bg-red-600 hover:text-white text-foreground"
        onClick={() => appWindow.close()}
        title="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M0.707107 0L5 4.29289L9.29289 0L10 0.707107L5.70711 5L10 9.29289L9.29289 10L5 5.70711L0.707107 10L0 9.29289L4.29289 5L0 0.707107L0.707107 0Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  );
}
