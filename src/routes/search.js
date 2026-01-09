const router = require("express").Router();
const searchController = require("../controllers/searchController");
const authenticate = require("../middleware/authenticate");

router.post("/advanced", authenticate, searchController.advancedSearch);
router.post("/save", authenticate, searchController.saveSearch);
router.get("/saved", authenticate, searchController.getSavedSearches);
router.delete("/saved/:id", authenticate, searchController.deleteSavedSearch);
router.post("/execute/:id", authenticate, searchController.executeSearch);

module.exports = router;
