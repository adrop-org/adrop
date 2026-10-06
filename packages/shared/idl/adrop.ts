/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/adrop.json`.
 */
export type Adrop = {
  "address": "BAj8sscSBTkfmcBUySDWBUbiYRcFkP7vH1DQ5HETNpm8",
  "metadata": {
    "name": "adrop",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Adrop rewarded-ads program"
  },
  "instructions": [
    {
      "name": "activateCampaign",
      "discriminator": [
        17,
        214,
        3,
        27,
        91,
        67,
        44,
        171
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "escrowAta",
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "config.usdcMint",
                "account": "config"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "createCampaign",
      "discriminator": [
        111,
        131,
        187,
        98,
        160,
        193,
        114,
        244
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "escrowAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        },
        {
          "name": "advertiser",
          "type": "pubkey"
        },
        {
          "name": "segmentRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "pricePerView",
          "type": "u64"
        },
        {
          "name": "minDwellMs",
          "type": "u32"
        },
        {
          "name": "freqCap",
          "type": "u8"
        }
      ]
    },
    {
      "name": "endCampaign",
      "discriminator": [
        6,
        152,
        36,
        161,
        147,
        29,
        30,
        90
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.id",
                "account": "campaign"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "protocolTreasuryAta"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "attester",
          "type": "pubkey"
        },
        {
          "name": "sgtGroup",
          "type": "pubkey"
        },
        {
          "name": "usdcMint",
          "type": "pubkey"
        },
        {
          "name": "globalDailyCap",
          "type": "u16"
        }
      ]
    },
    {
      "name": "payView",
      "discriminator": [
        74,
        30,
        172,
        191,
        69,
        162,
        31,
        94
      ],
      "accounts": [
        {
          "name": "viewer",
          "signer": true
        },
        {
          "name": "attester",
          "signer": true
        },
        {
          "name": "feePayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "identity",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "identity.proofNullifier",
                "account": "identity"
              }
            ]
          }
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "escrowAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "viewerAta",
          "writable": true
        },
        {
          "name": "hostAta",
          "writable": true
        },
        {
          "name": "protocolTreasuryAta",
          "writable": true
        },
        {
          "name": "impression",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  109,
                  112,
                  114,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "arg",
                "path": "nonceHash"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "merkleProof",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        }
      ]
    },
    {
      "name": "registerIdentity",
      "discriminator": [
        164,
        118,
        227,
        177,
        47,
        176,
        187,
        248
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "sgtTokenAccount"
        },
        {
          "name": "sgtMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "identity",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "proofNullifier"
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
          "name": "proofNullifier",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "withdrawUnspent",
      "discriminator": [
        189,
        32,
        15,
        199,
        98,
        73,
        236,
        235
      ],
      "accounts": [
        {
          "name": "advertiser",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "campaign",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "escrowAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "advertiserAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "campaign",
      "discriminator": [
        50,
        40,
        49,
        11,
        157,
        220,
        229,
        192
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "identity",
      "discriminator": [
        58,
        132,
        5,
        12,
        176,
        164,
        85,
        112
      ]
    },
    {
      "name": "impression",
      "discriminator": [
        253,
        135,
        50,
        185,
        90,
        115,
        42,
        238
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "sgtNotOwned",
      "msg": "SGT token account is not owned by the signer"
    },
    {
      "code": 6001,
      "name": "sgtZeroBalance",
      "msg": "SGT token account holds no token"
    },
    {
      "code": 6002,
      "name": "sgtWrongTokenProgram",
      "msg": "SGT mint is not a Token-2022 mint"
    },
    {
      "code": 6003,
      "name": "sgtMissingExtension",
      "msg": "SGT mint lacks the MetadataPointer or TokenGroupMember extension"
    },
    {
      "code": 6004,
      "name": "sgtWrongMetadataPointer",
      "msg": "SGT mint metadata pointer does not point at the SGT group"
    },
    {
      "code": 6005,
      "name": "sgtWrongGroup",
      "msg": "SGT mint is not a member of the SGT group"
    },
    {
      "code": 6006,
      "name": "badNullifier",
      "msg": "Proof nullifier does not match the SGT mint"
    },
    {
      "code": 6007,
      "name": "zeroPrice",
      "msg": "Price per view must be positive"
    },
    {
      "code": 6008,
      "name": "wrongCampaignStatus",
      "msg": "Campaign is not in the expected status"
    },
    {
      "code": 6009,
      "name": "escrowUnderfunded",
      "msg": "Escrow holds less than one view's price"
    },
    {
      "code": 6010,
      "name": "badMerkleProof",
      "msg": "Merkle proof does not prove segment membership"
    },
    {
      "code": 6011,
      "name": "globalCapExceeded",
      "msg": "Identity reached the global daily cap"
    },
    {
      "code": 6012,
      "name": "notAttester",
      "msg": "Signer is not the configured attester"
    },
    {
      "code": 6013,
      "name": "feePayerIsAttester",
      "msg": "Fee payer must differ from the attester"
    },
    {
      "code": 6014,
      "name": "identityNotOwned",
      "msg": "Identity is not owned by the viewer"
    },
    {
      "code": 6015,
      "name": "wrongMint",
      "msg": "Token account has the wrong mint"
    },
    {
      "code": 6016,
      "name": "unauthorized",
      "msg": "Signer is neither the advertiser nor the admin"
    }
  ],
  "types": [
    {
      "name": "campaign",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "advertiser",
            "type": "pubkey"
          },
          {
            "name": "hostAta",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "segmentRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "pricePerView",
            "type": "u64"
          },
          {
            "name": "minDwellMs",
            "type": "u32"
          },
          {
            "name": "freqCap",
            "type": "u8"
          },
          {
            "name": "budget",
            "type": "u64"
          },
          {
            "name": "spent",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "campaignStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "campaignStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "draft"
          },
          {
            "name": "active"
          },
          {
            "name": "ended"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "attester",
            "type": "pubkey"
          },
          {
            "name": "protocolTreasuryAta",
            "type": "pubkey"
          },
          {
            "name": "sgtGroup",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "globalDailyCap",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "identity",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "proofType",
            "type": "u8"
          },
          {
            "name": "proofNullifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "lastDay",
            "type": "u32"
          },
          {
            "name": "viewsToday",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "impression",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaign",
            "type": "pubkey"
          },
          {
            "name": "nonceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "identity",
            "type": "pubkey"
          },
          {
            "name": "paidAt",
            "type": "i64"
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
