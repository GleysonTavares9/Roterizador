{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-23.11"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.python311,
    pkgs.python311Packages.pip,
    pkgs.nodejs_20
    # pkgs.nodePackages.nodemon
  ];
  # Sets environment variables in the workspace
  env = {};
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];
    # Enable previews
    previews = {
      enable = true;
      previews = [
        {
          # Sets the port to forward
          port = 8000;
          # Decides whether to open the preview automatically
          open = true;
          # Gives the preview a name in the side panel
          name = "Backend";
          # The command to run to start the preview
          command = [
            "python3",
            "-m",
            "pip",
            "install",
            "-r",
            "backend/requirements.txt",
            "&&",
            "python3",
            "backend/app/fastapi_app.py"
          ];
        },
        {
          port = 3000;
          open = true;
          name = "Frontend";
          command = [
            "npm",
            "install",
            "--prefix",
            "frontend",
            "&&",
            "npm",
            "run",
            "dev",
            "--prefix",
            "frontend"
          ];
        }
      ];
    };
  };
}