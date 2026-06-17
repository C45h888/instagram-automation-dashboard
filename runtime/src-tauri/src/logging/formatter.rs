//! Deterministic formatter for log records.
//!
//! Every line emitted by a sink passes through [`Formatter::format`]. The
//! output is a single line of `key=value` pairs separated by a single
//! space. The five required fields are always emitted first, in a fixed
//! order, so log parsing does not depend on insertion order.

use super::{LogRecord, Severity};

#[derive(Debug)]
pub struct Formatter;

impl Formatter {
    /// Render a record as a single line.
    pub fn format(record: &LogRecord) -> String {
        // Use RFC3339 with second precision — sufficient for log
        // correlation and unambiguous across time zones.
        let mut out = String::new();
        out.push_str("timestamp=");
        out.push_str(&record.timestamp);
        out.push_str(" component=");
        out.push_str(&quote(&record.component));
        out.push_str(" severity=");
        out.push_str(record.severity.as_str());
        out.push_str(" event=");
        out.push_str(&quote(&record.event));
        out.push_str(" correlation_id=");
        out.push_str(&record.correlation_id);
        for (k, v) in &record.fields {
            out.push(' ');
            out.push_str(k);
            out.push('=');
            out.push_str(&quote(v));
        }
        out
    }
}

fn quote(value: &str) -> String {
    if value.contains(' ') || value.contains('"') || value.contains('\n') {
        let escaped = value.replace('"', "\\\"");
        format!("\"{}\"", escaped)
    } else {
        value.to_string()
    }
}

/// Convenience: produce a [`LogRecord`] with the current RFC3339 timestamp.
pub fn now_record(
    component: impl Into<String>,
    severity: Severity,
    event: impl Into<String>,
    correlation_id: impl Into<String>,
) -> LogRecord {
    LogRecord {
        timestamp: now_rfc3339(),
        component: component.into(),
        severity,
        event: event.into(),
        correlation_id: correlation_id.into(),
        fields: Vec::new(),
    }
}

pub fn now_rfc3339() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Minimal conversion: seconds since epoch -> RFC3339 UTC. We avoid
    // pulling in `chrono` / `time` to keep the dependency footprint
    // small. Resolution is one second — sufficient for log correlation.
    let (year, month, day, hour, minute, second) = epoch_to_ymdhms(now);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

fn epoch_to_ymdhms(secs: u64) -> (i32, u32, u32, u32, u32, u32) {
    // Civil-from-days algorithm (Howard Hinnant). Avoids dependency on
    // external datetime crates.
    let days = (secs / 86_400) as i64;
    let secs_of_day = (secs % 86_400) as u32;
    let hour = secs_of_day / 3600;
    let minute = (secs_of_day % 3600) / 60;
    let second = secs_of_day % 60;

    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64; // [0, 146_096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32; // [1, 12]
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d, hour, minute, second)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_emits_required_fields_in_order() {
        let record = LogRecord {
            timestamp: "2024-01-01T00:00:00Z".into(),
            component: "bootstrap::startup".into(),
            severity: Severity::Info,
            event: "runtime.boot.phase.complete".into(),
            correlation_id: "00000000-0000-0000-0000-000000000000".into(),
            fields: vec![("phase".into(), "configure".into())],
        };
        let line = Formatter::format(&record);
        // Required fields appear first, in fixed order.
        let t = line.find("timestamp=").unwrap();
        let c = line.find(" component=").unwrap();
        let s = line.find(" severity=").unwrap();
        let e = line.find(" event=").unwrap();
        let ci = line.find(" correlation_id=").unwrap();
        assert!(t < c && c < s && s < e && e < ci, "field order: {}", line);
    }

    #[test]
    fn epoch_to_ymdhms_handles_known_unix_epoch() {
        let (y, m, d, h, mi, s) = epoch_to_ymdhms(0);
        assert_eq!((y, m, d, h, mi, s), (1970, 1, 1, 0, 0, 0));
    }

    #[test]
    fn epoch_to_ymdhms_handles_2024_01_01() {
        // 2024-01-01T00:00:00Z = 1704067200
        let (y, m, d, h, mi, s) = epoch_to_ymdhms(1_704_067_200);
        assert_eq!((y, m, d, h, mi, s), (2024, 1, 1, 0, 0, 0));
    }
}
