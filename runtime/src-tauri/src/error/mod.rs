//! Error framework for the runtime kernel.
//!
//! The only error type used by the runtime is [`RuntimeError`], defined in
//! [`runtime_error`]. Domain errors are not represented here — they belong
//! to the preserved TypeScript platform.

pub mod runtime_error;
