//! Sorted-pair sha256 Merkle verify. Mirrors packages/shared/src/merkle.ts.

pub fn hash_pair(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
    solana_sha256_hasher::hashv(&[lo, hi]).to_bytes()
}

pub fn verify(root: &[u8; 32], leaf: &[u8; 32], proof: &[[u8; 32]]) -> bool {
    let mut node = *leaf;
    for sib in proof {
        node = hash_pair(&node, sib);
    }
    node == *root
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex32(s: &str) -> [u8; 32] {
        let mut out = [0u8; 32];
        for (i, b) in out.iter_mut().enumerate() {
            *b = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
        }
        out
    }

    #[test]
    fn shared_vectors() {
        let json = include_str!("../../../packages/shared/test-vectors/merkle.json");
        let cases: Vec<serde_json::Value> = serde_json::from_str(json).unwrap();
        assert!(!cases.is_empty());
        for c in cases {
            let root = hex32(c["root"].as_str().unwrap());
            let leaves: Vec<[u8; 32]> = c["leaves"].as_array().unwrap().iter().map(|l| hex32(l.as_str().unwrap())).collect();
            for (i, leaf) in leaves.iter().enumerate() {
                let proof: Vec<[u8; 32]> = c["proofs"][i].as_array().unwrap().iter().map(|p| hex32(p.as_str().unwrap())).collect();
                assert!(verify(&root, leaf, &proof), "leaf {i} of {}", leaves.len());
                assert!(!verify(&root, &[7u8; 32], &proof));
            }
        }
    }
}
