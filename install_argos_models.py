import os

import argostranslate.package


DEFAULT_PAIRS = "ja:en,en:ja,en:tl,tl:en"


def main() -> None:
    requested = os.getenv("ARGOS_PAIRS", DEFAULT_PAIRS)
    pairs = {tuple(pair.split(":", 1)) for pair in requested.split(",") if ":" in pair}

    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    installed = {
        (language.code, target.code)
        for language in argostranslate.translate.get_installed_languages()
        for target in language.translations_from
    }

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
