{
  description = "A flake to start a nodejs nix shell";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }: 
  let pkgs = nixpkgs.legacyPackages.x86_64-linux;
  in {
    devShells.x86_64-linux.default = pkgs.mkShell {
      buildInputs = [
        pkgs.nodejs
      ];

      shellHook = ''
        echo "Welcome to the development shell!"
        echo "Node.js version: $(node -v)"
      '';
    };
  };
}
