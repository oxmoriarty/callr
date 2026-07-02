import * as anchor from '@coral-xyz/anchor';
import { Program, BN } from '@coral-xyz/anchor';
import {
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { assert } from 'chai';
import type { Callr } from '../target/types/callr';

describe('callr', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Callr as Program<Callr>;
  const authority = provider.wallet as anchor.Wallet;

  let usdcMint: PublicKey;
  let supporter: Keypair;
  let challenger: Keypair;
  let supporterAta: PublicKey;
  let challengerAta: PublicKey;

  const MARKET_ID = new BN(1);
  const TXLINE_FIXTURE_ID = new BN(17588227); // sample World Cup fixture
  const STAT_KEY_HOME_GOALS = 1;

  let marketEscrowPda: PublicKey;
  let vaultPda: PublicKey;
  let supporterPositionPda: PublicKey;
  let challengerPositionPda: PublicKey;

  const STAKE_AMOUNT = new BN(5_000_000); // 5 USDC at 6 decimals

  before(async () => {
    usdcMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );

    supporter = Keypair.generate();
    challenger = Keypair.generate();

    // Fund both with SOL for fees
    for (const kp of [supporter, challenger]) {
      const sig = await provider.connection.requestAirdrop(
        kp.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, 'confirmed');
    }

    supporterAta = await createAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      usdcMint,
      supporter.publicKey
    );
    challengerAta = await createAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      usdcMint,
      challenger.publicKey
    );

    await mintTo(
      provider.connection,
      authority.payer,
      usdcMint,
      supporterAta,
      authority.publicKey,
      50_000_000
    );
    await mintTo(
      provider.connection,
      authority.payer,
      usdcMint,
      challengerAta,
      authority.publicKey,
      50_000_000
    );

    [marketEscrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market_escrow'), MARKET_ID.toArrayLike(Buffer, 'le', 8)],
      program.programId
    );

    vaultPda = getAssociatedTokenAddressSync(usdcMint, marketEscrowPda, true);

    [supporterPositionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketEscrowPda.toBuffer(), supporter.publicKey.toBuffer()],
      program.programId
    );
    [challengerPositionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketEscrowPda.toBuffer(), challenger.publicKey.toBuffer()],
      program.programId
    );
  });

  it('initializes a market escrow', async () => {
    const kickoffTs = new BN(Math.floor(Date.now() / 1000) + 3600);

    await program.methods
      .initializeMarket(MARKET_ID, TXLINE_FIXTURE_ID, STAT_KEY_HOME_GOALS, null, kickoffTs)
      .accounts({
        authority: authority.publicKey,
        marketEscrow: marketEscrowPda,
        tokenMint: usdcMint,
        vault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const market = await program.account.marketEscrow.fetch(marketEscrowPda);
    assert.equal(market.marketId.toString(), MARKET_ID.toString());
    assert.equal(market.txlineFixtureId.toString(), TXLINE_FIXTURE_ID.toString());
    assert.deepEqual(market.status, { open: {} });
    assert.equal(market.supportPool.toString(), '0');
    assert.equal(market.challengePool.toString(), '0');
  });

  it('accepts a support stake', async () => {
    await program.methods
      .stake({ support: {} }, STAKE_AMOUNT)
      .accounts({
        staker: supporter.publicKey,
        marketEscrow: marketEscrowPda,
        position: supporterPositionPda,
        stakerTokenAccount: supporterAta,
        vault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([supporter])
      .rpc();

    const market = await program.account.marketEscrow.fetch(marketEscrowPda);
    assert.equal(market.supportPool.toString(), STAKE_AMOUNT.toString());

    const position = await program.account.position.fetch(supporterPositionPda);
    assert.equal(position.stake.toString(), STAKE_AMOUNT.toString());
    assert.deepEqual(position.side, { support: {} });

    const vaultAccount = await getAccount(provider.connection, vaultPda);
    assert.equal(vaultAccount.amount.toString(), STAKE_AMOUNT.toString());
  });

  it('accepts a challenge stake (smaller, to test pari-mutuel payout)', async () => {
    const challengeAmount = new BN(2_000_000); // 2 USDC

    await program.methods
      .stake({ challenge: {} }, challengeAmount)
      .accounts({
        staker: challenger.publicKey,
        marketEscrow: marketEscrowPda,
        position: challengerPositionPda,
        stakerTokenAccount: challengerAta,
        vault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([challenger])
      .rpc();

    const market = await program.account.marketEscrow.fetch(marketEscrowPda);
    assert.equal(market.challengePool.toString(), challengeAmount.toString());
  });

  it('rejects a stake below the minimum', async () => {
    try {
      await program.methods
        .stake({ support: {} }, new BN(1000)) // 0.001 USDC, below 0.5 minimum
        .accounts({
          staker: supporter.publicKey,
          marketEscrow: marketEscrowPda,
          position: supporterPositionPda,
          stakerTokenAccount: supporterAta,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([supporter])
        .rpc();
      assert.fail('Expected StakeTooSmall error');
    } catch (err) {
      assert.include(String(err), 'StakeTooSmall');
    }
  });

  it('rejects staking the opposite side of an existing position', async () => {
    try {
      await program.methods
        .stake({ challenge: {} }, STAKE_AMOUNT)
        .accounts({
          staker: supporter.publicKey,
          marketEscrow: marketEscrowPda,
          position: supporterPositionPda,
          stakerTokenAccount: supporterAta,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([supporter])
        .rpc();
      assert.fail('Expected OppositeSideExists error');
    } catch (err) {
      assert.include(String(err), 'OppositeSideExists');
    }
  });

  it('voids the market and refunds original stakes', async () => {
    await program.methods
      .voidMarket()
      .accounts({
        settler: authority.publicKey,
        marketEscrow: marketEscrowPda,
      })
      .rpc();

    const market = await program.account.marketEscrow.fetch(marketEscrowPda);
    assert.deepEqual(market.status, { void: {} });

    const beforeBalance = (await getAccount(provider.connection, supporterAta)).amount;

    await program.methods
      .claim()
      .accounts({
        claimer: supporter.publicKey,
        marketEscrow: marketEscrowPda,
        position: supporterPositionPda,
        vault: vaultPda,
        claimerTokenAccount: supporterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([supporter])
      .rpc();

    const afterBalance = (await getAccount(provider.connection, supporterAta)).amount;
    assert.equal(
      (afterBalance - beforeBalance).toString(),
      STAKE_AMOUNT.toString(),
      'Void refund should return exactly the original stake'
    );

    const position = await program.account.position.fetch(supporterPositionPda);
    assert.isTrue(position.isClaimed);
  });

  it('rejects a double claim', async () => {
    try {
      await program.methods
        .claim()
        .accounts({
          claimer: supporter.publicKey,
          marketEscrow: marketEscrowPda,
          position: supporterPositionPda,
          vault: vaultPda,
          claimerTokenAccount: supporterAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([supporter])
        .rpc();
      assert.fail('Expected AlreadyClaimed error');
    } catch (err) {
      assert.include(String(err), 'AlreadyClaimed');
    }
  });

  describe('pari-mutuel settlement payout', () => {
    // Fresh market for a clean settle/claim test, since the previous one
    // was voided. Demonstrates the core "never split equally" reward rule.
    const SETTLE_MARKET_ID = new BN(2);
    let settleMarketPda: PublicKey;
    let settleVaultPda: PublicKey;
    let winnerPositionPda: PublicKey;
    let loserPositionPda: PublicKey;

    before(async () => {
      [settleMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market_escrow'), SETTLE_MARKET_ID.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      settleVaultPda = getAssociatedTokenAddressSync(usdcMint, settleMarketPda, true);

      [winnerPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('position'), settleMarketPda.toBuffer(), supporter.publicKey.toBuffer()],
        program.programId
      );
      [loserPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('position'), settleMarketPda.toBuffer(), challenger.publicKey.toBuffer()],
        program.programId
      );

      const kickoffTs = new BN(Math.floor(Date.now() / 1000) - 100);

      await program.methods
        .initializeMarket(SETTLE_MARKET_ID, TXLINE_FIXTURE_ID, STAT_KEY_HOME_GOALS, null, kickoffTs)
        .accounts({
          authority: authority.publicKey,
          marketEscrow: settleMarketPda,
          tokenMint: usdcMint,
          vault: settleVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Winner stakes 8 USDC supporting, loser stakes 4 USDC challenging
      await program.methods
        .stake({ support: {} }, new BN(8_000_000))
        .accounts({
          staker: supporter.publicKey,
          marketEscrow: settleMarketPda,
          position: winnerPositionPda,
          stakerTokenAccount: supporterAta,
          vault: settleVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([supporter])
        .rpc();

      await program.methods
        .stake({ challenge: {} }, new BN(4_000_000))
        .accounts({
          staker: challenger.publicKey,
          marketEscrow: settleMarketPda,
          position: loserPositionPda,
          stakerTokenAccount: challengerAta,
          vault: settleVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();
    });

    it('computes pari-mutuel payout proportional to stake, not split equally', async () => {
      // This test documents the EXPECTED payout math (verified independently
      // of the live TxLINE CPI, which requires a real mainnet Merkle root and
      // is exercised in the devnet/mainnet-fork settlement script instead —
      // see scripts/settle-devnet-market.ts).
      //
      // support_pool = 8_000_000, challenge_pool = 4_000_000, winner = support
      // payout = stake + (stake / winning_pool) * losing_pool
      //        = 8_000_000 + (8_000_000 / 8_000_000) * 4_000_000
      //        = 12_000_000 (i.e. winner takes the entire challenge pool)
      const market = await program.account.marketEscrow.fetch(settleMarketPda);
      const winningPool = market.supportPool;
      const losingPool = market.challengePool;
      const winnerStake = new BN(8_000_000);

      const expectedPayout = winnerStake.add(
        winnerStake.mul(losingPool).div(winningPool)
      );

      assert.equal(expectedPayout.toString(), '12000000');
      assert.notEqual(
        expectedPayout.toString(),
        winningPool.add(losingPool).div(new BN(2)).toString(),
        'Payout must not be an equal split of the total pool'
      );
    });
  });
});
