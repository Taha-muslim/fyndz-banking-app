const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// If running on Render, use the Cloud DB. If running locally, use your Laptop DB.
const dbUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/fyndz-bank';

mongoose.connect(dbUrl)
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.error("DB Error:", err));

// ✅ UPDATED ACCOUNT MODEL (Tracks Card Status)
const Account = mongoose.model('Account', {
    user: String,
    pin: Number,
    balance: Number,
    cardFrozen: { type: Boolean, default: false } // New Feature
});

const Transaction = mongoose.model('Transaction', {
    sender: String,
    receiver: String,
    amount: Number,
    type: String, // 'transfer', 'request', 'bill'
    date: { type: Date, default: Date.now }
});

// ROUTES
app.post('/register', async (req, res) => {
    const { user, pin } = req.body;
    if(await Account.findOne({ user })) return res.status(400).json({ error: "User exists" });
    await new Account({ user, pin, balance: 2500 }).save(); // Higher starting balance for testing
    res.json({ message: "Account created!" });
});

app.post('/login', async (req, res) => {
    const { user, pin } = req.body;
    const account = await Account.findOne({ user });
    if (!account || account.pin !== Number(pin)) return res.status(401).json({ error: "Invalid Credentials" });
    res.json({ message: "Success", user: account.user, balance: account.balance, cardFrozen: account.cardFrozen });
});

app.get('/balance/:user', async (req, res) => {
    const account = await Account.findOne({ user: req.params.user });
    res.json({ balance: account.balance, cardFrozen: account.cardFrozen });
});

// TRANSFER
app.post('/transfer', async (req, res) => {
    const { fromUser, toUser, amount, type } = req.body;
    const sender = await Account.findOne({ user: fromUser });
    const receiver = await Account.findOne({ user: toUser }); // For bills, receiver might be "Electric Co"

    if (!sender) return res.status(400).json({ error: "User not found" });
    if (sender.cardFrozen && type !== 'bill') return res.status(400).json({ error: "Card is Frozen!" }); // Security Feature
    if (sender.balance < amount) return res.status(400).json({ error: "Insufficient funds" });

    sender.balance -= amount;
    await sender.save();

    if(receiver) {
        receiver.balance += amount;
        await receiver.save();
    }

    await new Transaction({ sender: fromUser, receiver: toUser, amount, type: type || 'transfer' }).save();
    res.json({ message: "Success" });
});

// TOGGLE CARD FREEZE
app.post('/toggle-card', async (req, res) => {
    const { user } = req.body;
    const account = await Account.findOne({ user });
    account.cardFrozen = !account.cardFrozen;
    await account.save();
    res.json({ status: account.cardFrozen });
});

app.get('/history/:user', async (req, res) => {
    const history = await Transaction.find({ $or: [{ sender: req.params.user }, { receiver: req.params.user }] });
    res.json(history);
});

app.listen(4000, () => console.log("Fyndz Pro Server Running..."));