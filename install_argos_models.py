import os

# Keep the package directory in sync with backend_main.py. Deployments can
# override it for their own image or persistent volume.
os.environ.setdefault(
    "ARGOS_PACKAGES_DIR",
    os.path.join(os.path.dirname(__file__), "argos-packages"),
)
os.environ.setdefault("ARGOS_DEVICE_TYPE", "cpu")
os.environ.setdefault("ARGOS_INTER_THREADS", "1")
os.environ.setdefault("ARGOS_INTRA_THREADS", "1")
os.environ.setdefault("ARGOS_BATCH_SIZE", "8")

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
    installed = {
        (package.from_code, package.to_code)
        for package in argostranslate.package.get_installed_packages()
        if package.type == "translate"
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

    argostranslate.translate.get_installed_languages.cache_clear()
    final_pairs = {
        (package.from_code, package.to_code)
        for package in argostranslate.package.get_installed_packages()
        if package.type == "translate"
    }
    print(
        "Installed Argos pairs: "
        + ", ".join(f"{source}->{target}" for source, target in sorted(final_pairs))
    )


if __name__ == "__main__":
    import argostranslate.translate

    main()
