const express = require("express");
const router = express.Router();
const { protect, checkRole } = require("../middleware/authMiddleware");
const { getAdminOverview, getTherapistsUsers, createTherapist, updateTherapist, deleteTherapist, assignChildrenToTherapist, childUsers, createChild, updateChild, deleteChild, getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, getStaffOnLeaveToday } = require("../controllers/adminController");
const { getUsersByRole } = require("../controllers/CommonController");

router.get("/overview",  getAdminOverview);
router.get("/get_therapists",  getTherapistsUsers);
router.get("/users",  getUsersByRole);


router.post("/therapists", createTherapist);
router.put("/therapists/:id", updateTherapist);
router.delete("/therapists/:id", deleteTherapist);
router.post("/therapists/assign", assignChildrenToTherapist);

router.get("/children", childUsers);
router.post("/children", createChild);
router.put("/children/:id", updateChild);
router.delete("/children/:id", deleteChild);

router.get("/leave-requests", protect,getLeaveRequests);
router.put("/leave-requests/:id/approve", protect,approveLeaveRequest);
router.put("/leave-requests/:id/reject", protect,rejectLeaveRequest);
router.get("/leave-requests/on-leave-today", protect,getStaffOnLeaveToday);

module.exports = router;
