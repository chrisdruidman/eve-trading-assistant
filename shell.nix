{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs
  ];

  shellHook = ''
    echo "Welcome to the development shell!"
    echo "Node.js version: $(node -v)"
  '';
}