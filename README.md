<div align="center">
  <h1>sangam.</h1>
</div>

A decentralized ROSCA (Rotating Savings and Credit Association — aka *chit fund*, *committee*, *kye*, *tanda*, *susu*) built on **Botchain** using Solidity smart contracts and a [Next.js](https://nextjs.org/) frontend.

> *Sangam* (संगम) — Sanskrit for "confluence." A meeting of streams.

A group of 2–10 members each contribute a fixed amount of native BOT every round. Each round, one member is selected at random (via a secure commit-reveal scheme that no one — including the organizer — can manipulate) and receives the entire pot. The cycle continues until every member has won exactly once.

- **No organizer custody.** The smart contract holds the pot — not a person.
- **Provably fair winner selection.** Each member commits a hashed secret, then reveals it. The contract XORs all revealed secrets to derive an unpredictable seed, then selects a winner from members who haven't won yet.
- **Native BOT transfers.** Contributions and payouts happen securely using Botchain's native currency.

---

## Architecture

- **Frontend:** Next.js 15, App Router, React 19, Tailwind CSS.
- **Smart Contract:** Solidity `^0.8.20`, optimized for Botchain Mainnet.
- **Database:** Supabase (for user profiles and dashboard synchronization).

## Running Locally

### 1. Prerequisites
- Node.js 18+
- npm 9+

### 2. Environment Setup
Create a `.env.local` file in the `frontend` directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BOTCHAIN_NETWORK=mainnet
NEXT_PUBLIC_CONTRACT_ID=0xYourDeployedContractAddress
```

### 3. Start Development Server
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## License

This project is licensed under the [Apache License 2.0](LICENSE).
