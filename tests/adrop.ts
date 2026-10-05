import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import { Adrop } from "../target/types/adrop";

describe("adrop", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.adrop as Program<Adrop>;

  it("loads the program", () => {
    expect(program.programId.toBase58()).to.have.length.greaterThan(30);
  });
});
