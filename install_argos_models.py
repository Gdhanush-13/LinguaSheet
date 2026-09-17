import os

# Keep downloaded models inside Render's built application directory so the
# same packages are available when the runtime process starts.
os.environ.setdefault(
    "ARGOS_PACKAGES_DIR",
    os.path.join(os.path.dirname(__file__), "argos-packages"),
)

import argostranslate.package
import argostranslate.translate


# Keep the Render free instance focused on the two priority inbound workflows.
# Additional language pairs can be enabled later with ARGOS_PAIRS.
DEFAULT_PAIRS = "ja:en,tl:en"


def main() -> None:
    requested = os.getenv("ARGOS_PAIRS", DEFAULT_PAIRS)
    pairs = {tuple(pair.split(":", 1)) for pair in requested.split(",") if ":" in pair}

    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    installed = set()
    for language in argostranslate.translate.get_installed_languages():
        for translation in language.translations_from:
            from_language = getattr(translation, "from_lang", None)
            to_language = getattr(translation, "to_lang", None)
            if from_language and to_language:
                installed.add((from_language.code, to_language.code))

    for from_code, to_code in sorted(pairs):
        if (from_code, to_code) in installed:
            print(f"Argos model already installed: {from_code}->{to_code}")
            continue

        package = next(
            (
                item
                for item in available
                if item.from_code == from_code and item.to_code == to_code
            ),
            None,
        )
        if package is None:
            raise RuntimeError(f"No Argos model found for {from_code}->{to_code}")

        print(f"Installing Argos model: {from_code}->{to_code}")
        argostranslate.package.install_from_path(package.download())


if __name__ == "__main__":
    import argostranslate.translate

    main()
