const prisma = require('../prismaClient');
const supabase = require('../../supabase/supabase')

exports.getAllChapters = async () => {
  try {
    const chapters = await prisma.chapter.findMany();
    return chapters;
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.getChapterById = async (id) => {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: {
        id,
      },
    });
    return chapter;
  } catch (error) {
    throw new Error(`Error retrieving chapter with id ${id}`);
  }
};

exports.createChapter = async (newData) => {
  try {
    const lastChapter = await prisma.chapter.findFirst({
      where: { courseId: newData.courseId },
      orderBy: { level: "desc" },
      select: { level: true },
    });

    const newLevel = lastChapter ? lastChapter.level + 1 : 1;

    const newChapter = await prisma.chapter.create({
      data: {
        ...newData,
        level: newLevel,
      },
    });

    return newChapter;
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.updateChapter = async (id, updateData) => {
  try {
    const chapter = await prisma.chapter.update({
      where: { id },
      data: updateData,
    });
    return chapter;
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.deleteChapter = async (id) => {
  try {
     // Ambil semua assignment terkait dengan chapter yang akan dihapus
    const assignments = await prisma.assignment.findMany({
      where: { chapterId: id },
      select: { fileUrl: true },
    });

    // Hapus file dari Supabase Storage
    for (const assignment of assignments) {
      if (assignment.fileUrl) {
        const fileName = assignment.fileUrl.split('/').pop();
        const filePath = `assignment/${id}/${fileName}`;

        const { error } = await supabase.storage
          .from('assignment')
          .remove([filePath]);

        if (error) {
          console.error('Error deleting file from Supabase:', error.message);
        }
      }
    }

    await prisma.chapter.delete({
      where: { id },
    });
    return `Successfully deleted chapter with id: ${id}`;
  } catch (error) {
    throw new Error("Error deleting chapter: " + error.message);
  }
};

// SPECIAL SERVICES
exports.getMaterialsByChapter = async (id) => {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: {
        id: parseInt(id),
      },
      select: {
        materials: true,
      },
    });

    if (!chapter) {
      throw new Error(`No chapter found from chapter with id ${id}`);
    }

    if (!chapter.materials || chapter.materials.length === 0) {
    }

    return chapter.materials[0];
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.getAssessmentsByChapter = async (id) => {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: {
        id: parseInt(id),
      },
      select: {
        assessments: true,
      },
    });

    if (!chapter) {
      throw new Error(`No assessment found from chapter with id ${id}`);
    }

    if (!chapter.assessments || chapter.assessments.length === 0) {
    }

    return chapter.assessments[0];
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.getAssignmentsByChapter = async (id) => {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: {
        id: parseInt(id),
      },
      select: {
        assignments: true,
      },
    });

    if (!chapter) {
      throw new Error(`No chapter found from chapter with id ${id}`);
    }

    if (!chapter.assignments || chapter.assignments.length === 0) {
    }

    return chapter.assignments[0];
  } catch (error) {
    throw new Error(error.message);
  }
};

exports.getUserChapterByChapterId = async (id) => {
  try {
    const userChapter = await prisma.userChapter.findMany({
      include: {
        user: {
          select: {
            name: true,
            studentId: true,
          }
        }
      },
      where: {
        chapterId: id,
      }
    })
    return userChapter;
  } catch (error) {
    throw new Error(error.message);
  }
}