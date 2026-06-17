// Prevents additional console window on Windows in release, DO NOT REMOVE
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use automation_kernel::bootstrap::runtime::Runtime;
use automation_kernel::RuntimeResult;

fn main() -> RuntimeResult<()> {
    // `Runtime::boot()` returns a `RuntimeHandle` carrying the
    // correlation_id and boot timestamp. We drop the handle after
    // extracting what `main` needs to log the final completion event.
    let handle = Runtime::boot()?;
    tracing::info!(
        target: "bootstrap::runtime",
        event = "runtime.boot.handle.received",
        correlation_id = %handle.correlation_id(),
        booted_at_epoch_secs = handle.booted_at_epoch_secs(),
        "runtime handle received by main",
    );
    Ok(())
}
