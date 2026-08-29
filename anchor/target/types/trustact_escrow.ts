/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/trustact_escrow.json`.
 */
export type TrustactEscrow = {
  "address": "592wks1UXnk4arVMb3N8S7xcu2dgKp8LiGFNHheVap7N",
  "metadata": {
    "name": "trustactEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Trustact per-round escrow vault"
  },
  "instructions": [
    {
      "name": "closeRound",
      "docs": [
        "Authority-only: closes the vault once its payouts are done, refunding",
        "whatever's left (normally just the rent-exempt minimum) to itself."
      ],
      "discriminator": [
        149,
        14,
        81,
        88,
        230,
        226,
        234,
        37
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "roundVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "roundId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "deposit",
      "docs": [
        "Asker deposits the round's fee into a fresh PDA vault keyed by",
        "`round_id` (the same UUID, as raw bytes, used off-chain)."
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "asker",
          "writable": true,
          "signer": true
        },
        {
          "name": "roundVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "roundId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payoutOne",
      "docs": [
        "Authority-only: pays one recipient out of the round's vault. Called",
        "once per winner in the same transaction — Solana allows multiple",
        "instructions per transaction, so a whole round's payout is still one",
        "atomic, all-or-nothing send."
      ],
      "discriminator": [
        192,
        231,
        64,
        94,
        249,
        108,
        63,
        235
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "roundVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "roundId"
              }
            ]
          }
        },
        {
          "name": "recipient",
          "docs": [
            "much they get from off-chain judging before this instruction is ever",
            "built — this program just moves the lamports, it doesn't decide."
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "roundVault",
      "discriminator": [
        143,
        169,
        210,
        32,
        221,
        123,
        199,
        119
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "zeroAmount",
      "msg": "Deposit amount must be greater than zero."
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Only the Trustact backend authority can release escrowed funds."
    },
    {
      "code": 6002,
      "name": "insufficientVaultBalance",
      "msg": "Vault does not have enough balance for this payout."
    },
    {
      "code": 6003,
      "name": "overflow",
      "msg": "Payout amount overflowed."
    }
  ],
  "types": [
    {
      "name": "roundVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asker",
            "type": "pubkey"
          },
          {
            "name": "roundId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
