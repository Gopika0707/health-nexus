# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Synthetic Federated Demo Data

Generate hospital-wise synthetic datasets for the federated learning demo:

```sh
python -m backend.federated.generate_synthetic_data --output-dir demo_data/federated --hospitals 3 --patients-per-hospital 120 --time-steps 30
```

This creates:

- `patients.csv` for tabular risk-classification data
- `vitals_timeseries.csv` for LSTM-style longitudinal vitals
- `image_manifest.csv` with placeholder image labels for CNN demos
- `manifest.json` summarizing all generated hospital nodes

Train a synthetic federated tabular model on the generated hospital folders:

```sh
python -m backend.federated.train_synthetic_federated --data-dir demo_data/federated --rounds 8 --local-epochs 5 --output demo_data/federated/training_summary.json
```

Import a subset of the synthetic hospital dataset into MySQL for dashboard demos:

```sh
python -m backend.federated.import_synthetic_to_db --data-dir demo_data/federated --doctor-id DOC-4892 --max-patients-per-hospital 8
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
