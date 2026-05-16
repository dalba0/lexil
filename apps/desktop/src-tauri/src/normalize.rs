//! Mirror of `pipeline/normalize.py` so the runtime query and the build-time
//! `headword_normalized` column agree on what "the same string" means.

use unicode_normalization::UnicodeNormalization;

pub fn normalize(s: &str) -> String {
    s.nfd()
        .filter(|c| !unicode_normalization::char::is_combining_mark(*c))
        .nfc()
        .collect::<String>()
        .to_lowercase()
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_accents_and_lowercases() {
        assert_eq!(normalize("café"), "cafe");
        assert_eq!(normalize("MAÑANA"), "manana");
        assert_eq!(normalize("corrió"), "corrio");
        assert_eq!(normalize("niño"), "nino");
    }
}
