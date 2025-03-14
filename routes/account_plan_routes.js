const express = require('express');
const router = express.Router();
const accountPlanSchema = require('../models/account_plan_schema');
const { getModel, getAccount } = require("../utils/utils");

const getAccountPlanModel = async (req) => {
    const account = getAccount(req);
    return getModel(account, accountPlanSchema, "AccountPlan");
};

router.post('/', async (req, res) => {
    try {
        const { account_id, plan } = req.body;
        const AccountPlan = await getAccountPlanModel(req);

        // Check if account_id already exists
        let existingEntry = await AccountPlan.findOne({ account_id });

        if (existingEntry) {
            // Update existing entry
            existingEntry.plan = plan;
            const updatedEntry = await existingEntry.save();
            return res.status(200).json({ 
                success: true, 
                message: 'Account plan updated successfully', 
                data: updatedEntry 
            });
        } else {
            // Create new entry
            const newEntry = new AccountPlan({ account_id, plan });
            const savedEntry = await newEntry.save();
            return res.status(201).json({ 
                success: true, 
                message: 'Account plan created successfully', 
                data: savedEntry 
            });
        }
    } catch (error) {
        console.error('Error processing account plan:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error processing account plan', 
            error: error.message 
        });
    }
});


// Get all AccountPlan entries
router.get('/', async (req, res) => {
    try {
        const AccountPlan = await getAccountPlanModel(req);
        const entries = await AccountPlan.find();
        res.status(200).json({ success: true, data: entries });
    } catch (error) {
        console.error('Error fetching account plans:', error);
        res.status(500).json({ success: false, message: 'Error fetching account plans', error: error.message });
    }
});

// Get a single AccountPlan entry by ID
router.get('/:id', async (req, res) => {
    try {
        const AccountPlan = await getAccountPlanModel(req);
        const entry = await AccountPlan.findById(req.params.id);
        if (!entry) {
            return res.status(404).json({ success: false, message: 'Account plan not found' });
        }
        res.status(200).json({ success: true, data: entry });
    } catch (error) {
        console.error('Error fetching account plan:', error);
        res.status(500).json({ success: false, message: 'Error fetching account plan', error: error.message });
    }
});

// Update an AccountPlan entry by ID
router.put('/:id', async (req, res) => {
    try {
        const { account_id, plan } = req.body;
        const AccountPlan = await getAccountPlanModel(req);
        const updatedEntry = await AccountPlan.findByIdAndUpdate(
            req.params.id,
            { account_id, plan },
            { new: true, runValidators: true }
        );
        if (!updatedEntry) {
            return res.status(404).json({ success: false, message: 'Account plan not found' });
        }
        res.status(200).json({ success: true, message: 'Account plan updated successfully', data: updatedEntry });
    } catch (error) {
        console.error('Error updating account plan:', error);
        res.status(500).json({ success: false, message: 'Error updating account plan', error: error.message });
    }
});

// Delete an AccountPlan entry by ID
router.delete('/:id', async (req, res) => {
    try {
        const AccountPlan = await getAccountPlanModel(req);
        const deletedEntry = await AccountPlan.findByIdAndDelete(req.params.id);
        if (!deletedEntry) {
            return res.status(404).json({ success: false, message: 'Account plan not found' });
        }
        res.status(200).json({ success: true, message: 'Account plan deleted successfully' });
    } catch (error) {
        console.error('Error deleting account plan:', error);
        res.status(500).json({ success: false, message: 'Error deleting account plan', error: error.message });
    }
});

module.exports = router;