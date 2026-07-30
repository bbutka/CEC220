# CEC220

Practice files and interactive learning tools for CEC220 Digital Circuit Design.

## Interactive tools

The GitHub Pages site is contained in [`docs/`](docs/). Its first guided
workbench covers fixed-width arithmetic:

- binary, decimal, and hexadecimal operand entry;
- selectable register width and signed/unsigned interpretation;
- addition with a visible carry chain;
- subtraction with borrows or two's complement;
- separate carry-out, borrow-out, signed-overflow, and unsigned-status checks;
- Learn, Practice, and Verify modes; and
- shareable instructor problem links.

The original Colab notebooks remain in the repository as reference
implementations and editable demonstrations.

## Publish with GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**,
select the `main` branch and `/docs` folder, and save. The course hub will be
published at:

`https://bbutka.github.io/CEC220/`

## Local validation

From the `docs` directory:

```text
npm test
```

The test exhaustively checks addition and subtraction for all operand pairs at
widths 2 through 8, including signed overflow and unsigned underflow.
