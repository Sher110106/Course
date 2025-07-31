import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

interface Course {
  _id?: Id<"userCourses">;
  title: string;
  description: string;
  institution?: string;
  credits?: number;
}

export function CourseInputForm() {
  const [editingCourse, setEditingCourse] = useState<Course>({
    title: "",
    description: "",
    institution: "",
    credits: undefined,
  });
  const [isEditing, setIsEditing] = useState(false);

  const userCourses = useQuery(api.courses.getUserCourses);
  const addCourse = useMutation(api.courses.addUserCourse);
  const updateCourse = useMutation(api.courses.updateUserCourse);
  const deleteCourse = useMutation(api.courses.deleteUserCourse);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingCourse.title.trim() || !editingCourse.description.trim()) {
      toast.error("Please fill in both title and description");
      return;
    }

    try {
      if (isEditing && editingCourse._id) {
        await updateCourse({
          id: editingCourse._id,
          title: editingCourse.title,
          description: editingCourse.description,
          institution: editingCourse.institution || undefined,
          credits: editingCourse.credits || undefined,
        });
        toast.success("Course updated successfully");
      } else {
        await addCourse({
          title: editingCourse.title,
          description: editingCourse.description,
          institution: editingCourse.institution || undefined,
          credits: editingCourse.credits || undefined,
        });
        toast.success("Course added successfully");
      }

      // Reset form
      setEditingCourse({
        title: "",
        description: "",
        institution: "",
        credits: undefined,
      });
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to save course");
    }
  };

  const handleEdit = (course: any) => {
    setEditingCourse({
      _id: course._id,
      title: course.title,
      description: course.description,
      institution: course.institution || "",
      credits: course.credits || undefined,
    });
    setIsEditing(true);
  };

  const handleDelete = async (courseId: Id<"userCourses">) => {
    try {
      await deleteCourse({ id: courseId });
      toast.success("Course deleted successfully");
    } catch (error) {
      toast.error("Failed to delete course");
    }
  };

  const handleCancel = () => {
    setEditingCourse({
      title: "",
      description: "",
      institution: "",
      credits: undefined,
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Course Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course Title *
            </label>
            <input
              type="text"
              value={editingCourse.title}
              onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Introduction to Programming"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institution
            </label>
            <input
              type="text"
              value={editingCourse.institution}
              onChange={(e) => setEditingCourse({ ...editingCourse, institution: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., University of XYZ"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Course Description *
          </label>
          <textarea
            value={editingCourse.description}
            onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Detailed description of what you learned in this course..."
            required
          />
        </div>

        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credits
          </label>
          <input
            type="number"
            value={editingCourse.credits || ""}
            onChange={(e) => setEditingCourse({ ...editingCourse, credits: e.target.value ? parseInt(e.target.value) : undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="3"
            min="1"
            max="10"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isEditing ? "Update Course" : "Add Course"}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Course List */}
      {userCourses && userCourses.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Your Courses</h3>
          <div className="space-y-3">
            {userCourses.map((course) => (
              <div key={course._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{course.title}</h4>
                    {course.institution && (
                      <p className="text-sm text-gray-600">{course.institution}</p>
                    )}
                    <p className="text-sm text-gray-700 mt-1">{course.description}</p>
                    {course.credits && (
                      <p className="text-xs text-gray-500 mt-1">{course.credits} credits</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(course)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(course._id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
