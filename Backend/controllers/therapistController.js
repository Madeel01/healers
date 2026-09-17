const mongoose = require("mongoose");
const TherapistAssignment = require("../models/TherapistAssignment");
const User = require("../models/User");
const Program = require("../models/Program");

exports.getTherapistUser = async (req, res) => {
  try {
    const rawTherapistId = req.query.filter || req.user?._id;

    if (!rawTherapistId) {
      return res.status(400).json({
        success: false,
        message: "Therapist ID is required.",
      });
    }

    const therapistId = new mongoose.Types.ObjectId(rawTherapistId);

    const assignment = await TherapistAssignment.findOne({ therapistId }).lean();
    const childIds = assignment?.childIds || [];

    const children = await User.find({
      _id: { $in: childIds },
    })
      .select("-password")
      .lean();

    return res.status(200).json({
      success: true,
      data: children,
    });
  } catch (error) {
    console.error("Error fetching assigned children:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned children.",
      error: error.message,
    });
  }
};

exports.getChildPrograms = async (req, res) => {
  try {
    const { childId } = req.params;
    const therapistId = req.query.therapistId || req.user?._id || req.user?.id;

    if (!childId || !therapistId) {
      return res.status(400).json({
        success: false,
        message: "Both childId and therapistId are required.",
      });
    }

    const programs = await Program.find({
      userId: childId,
      therapistId: therapistId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: programs.length,
      data: programs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.AddPrograms = async (req, res) => {
  try {
    const { therapistId, childId, programName, description, therapistTitle, therapistDescription, goals } = req.body;

    if (!therapistId || !childId || !programName) {
      return res.status(400).json({
        success: false,
        message: "therapistId, childId, and programName are required fields.",
      });
    }

    const formattedGoals = Array.isArray(goals)
      ? goals.map((g) => (typeof g === "string" ? { title: g } : g))
      : [];

    const createdProgram = await Program.create({
      userId: childId,
      therapistId,
      programName,
      description: description || "describe behavior, engagement,",
      therapistTitle: therapistTitle || "Therapist",
      therapistDescription: therapistDescription || "describe behavior, engagement,",
      programGoals: formattedGoals,
    });

    return res.status(201).json({
      success: true,
      program: createdProgram,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addGoalToProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Goal title is required." });
    }

    const updatedProgram = await Program.findByIdAndUpdate(
      programId,
      { $push: { programGoals: { title, status: "pending" } } },
      { new: true },
    );

    if (!updatedProgram) {
      return res.status(404).json({ success: false, message: "Program not found." });
    }

    return res.status(200).json({
      success: true,
      program: updatedProgram,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.updateGoalProgress = async (req, res) => {
  try {
    const { programId, goalId } = req.params;
    const { progress } = req.body;

    const numericProgress = Number(progress);
    if (isNaN(numericProgress) || numericProgress < 0 || numericProgress > 100) {
      return res.status(400).json({
        success: false,
        message: "Progress must be a number between 0 and 100",
      });
    }

    const updatedProgram = await Program.findOneAndUpdate(
      { _id: programId, "programGoals._id": goalId },
      { $set: { "programGoals.$.progress": numericProgress } },
      { new: true }
    );

    if (!updatedProgram) {
      return res.status(404).json({
        success: false,
        message: "Program or Goal not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Goal progress updated successfully",
      program: updatedProgram,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.deleteProgram = async (req, res) => {
  try {
    const { programId } = req.params;

    const deletedProgram = await Program.findByIdAndDelete(programId);

    if (!deletedProgram) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Program removed",
      programId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const { programId, goalId } = req.params;
    console.log("req", req.params);
    const updatedProgram = await Program.findByIdAndUpdate(
      programId,
      { $pull: { programGoals: { _id: goalId } } },
      { new: true },
    );

    if (!updatedProgram) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Goal deleted successfully",
      programId,
      goalId,
      program: updatedProgram,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
