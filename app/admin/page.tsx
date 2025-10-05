'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, UserPlus, Save, X, Edit2, Trash2 } from 'lucide-react';

interface User {
  id: number;
  name: string;
  profile_picture_url?: string;
  roles: string[];
  in_game: boolean;
  created_at: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // États pour la création d'utilisateur
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newProfilePicture, setNewProfilePicture] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploadingNewImage, setUploadingNewImage] = useState(false);

  // États pour l'édition
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editProfilePicture, setEditProfilePicture] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    fetchUserRole();
  }, [session, status, router]);

  useEffect(() => {
    if (userRoles.includes('admin')) {
      fetchUsers();
    } else if (userRoles.length > 0 && !loading) {
      router.push('/');
    }
  }, [userRoles, loading]);

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/users/me');
      if (response.ok) {
        const data = await response.json();
        setUserRoles(data.roles || []);
        if (!data.roles || !data.roles.includes('admin')) {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du rôle:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users/list');
      if (response.ok) {
        setUsers(await response.json());
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
    }
  };

  const toggleRole = (role: string, currentRoles: string[], setter: (roles: string[]) => void) => {
    if (currentRoles.includes(role)) {
      setter(currentRoles.filter(r => r !== role));
    } else {
      setter([...currentRoles, role]);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || creating) return;

    setCreating(true);
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          profilePictureUrl: newProfilePicture.trim() || null,
          roles: newUserRoles
        }),
      });

      if (response.ok) {
        setNewUsername('');
        setNewPassword('');
        setNewProfilePicture('');
        setNewUserRoles([]);
        setShowCreateForm(false);
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la création de l\'utilisateur');
      }
    } catch (error) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      alert('Erreur lors de la création de l\'utilisateur');
    } finally {
      setCreating(false);
    }
  };

  const updateUserRoles = async (userId: number) => {
    try {
      const response = await fetch('/api/users/update-role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roles: editRoles }),
      });

      if (response.ok) {
        fetchUsers();
        setEditingUser(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la modification des rôles');
      }
    } catch (error) {
      console.error('Erreur lors de la modification des rôles:', error);
      alert('Erreur lors de la modification des rôles');
    }
  };

  const updateUserPassword = async (userId: number, newPassword: string) => {
    if (!newPassword.trim()) return;

    try {
      const response = await fetch('/api/users/update-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password: newPassword }),
      });

      if (response.ok) {
        setEditPassword('');
        alert('Mot de passe modifié avec succès');
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la modification du mot de passe');
      }
    } catch (error) {
      console.error('Erreur lors de la modification du mot de passe:', error);
      alert('Erreur lors de la modification du mot de passe');
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload/profile-picture', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.url;
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors du téléchargement de l\'image');
        return null;
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement de l\'image:', error);
      alert('Erreur lors du téléchargement de l\'image');
      return null;
    }
  };

  const handleNewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingNewImage(true);
    const url = await uploadImage(file);
    setUploadingNewImage(false);

    if (url) {
      setNewProfilePicture(url);
    }
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingEditImage(true);
    const url = await uploadImage(file);
    setUploadingEditImage(false);

    if (url) {
      setEditProfilePicture(url);
    }
  };

  const updateProfilePicture = async (userId: number, profilePictureUrl: string) => {
    try {
      const response = await fetch('/api/users/update-profile-picture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, profilePictureUrl: profilePictureUrl.trim() || null }),
      });

      if (response.ok) {
        setEditProfilePicture('');
        fetchUsers();
        alert('Photo de profil mise à jour avec succès');
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la mise à jour de la photo de profil');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la photo de profil:', error);
      alert('Erreur lors de la mise à jour de la photo de profil');
    }
  };

  const deleteProfilePicture = async (userId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette photo de profil ?')) return;

    try {
      const response = await fetch('/api/users/delete-profile-picture', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setEditProfilePicture('');
        fetchUsers();
        alert('Photo de profil supprimée avec succès');
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la suppression de la photo de profil');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la photo de profil:', error);
      alert('Erreur lors de la suppression de la photo de profil');
    }
  };

  const deleteUser = async (userId: number, username: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${username}" ?`)) return;

    try {
      const response = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la suppression de l\'utilisateur');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
      alert('Erreur lors de la suppression de l\'utilisateur');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    );
  }

  if (!userRoles.includes('admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Créer un utilisateur
            </button>
          )}
        </div>

        <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-6 shadow-xl">
          <h1 className="text-2xl font-bold text-zinc-200 mb-6">Administration des utilisateurs</h1>

          {showCreateForm && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-zinc-200 mb-4">Créer un nouvel utilisateur</h2>
              <form onSubmit={createUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Nom d'utilisateur
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Nom d'utilisateur..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mot de passe..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Photo de profil (optionnel)
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handleNewImageUpload}
                      disabled={uploadingNewImage}
                      className="flex-1 text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer file:transition-colors disabled:opacity-50"
                    />
                    {uploadingNewImage && <span className="text-xs text-zinc-400">Téléchargement...</span>}
                  </div>
                  {newProfilePicture && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={newProfilePicture} alt="Aperçu" className="w-16 h-16 rounded-lg object-cover border border-zinc-700" />
                      <span className="text-xs text-green-400">✓ Image téléchargée</span>
                      <button
                        type="button"
                        onClick={() => setNewProfilePicture('')}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Rôles
                  </label>
                  <div className="space-y-2">
                    {['config_creator', 'room_creator', 'admin'].map(role => (
                      <label key={role} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUserRoles.includes(role)}
                          onChange={() => toggleRole(role, newUserRoles, setNewUserRoles)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm text-zinc-300">
                          {role === 'config_creator' && 'Config Creator (Créer des configurations)'}
                          {role === 'room_creator' && 'Room Creator (Créer des salons)'}
                          {role === 'admin' && 'Admin (Tous les droits)'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                  >
                    {creating ? 'Création...' : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Créer
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewUsername('');
                      setNewPassword('');
                      setNewUserRoles([]);
                    }}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4"
              >
                {editingUser?.id === user.id ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-medium text-zinc-200">{user.name}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateUserRoles(user.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Sauvegarder
                        </button>
                        <button
                          onClick={() => {
                            setEditingUser(null);
                            setEditPassword('');
                            setEditRoles([]);
                          }}
                          className="px-3 py-1 bg-zinc-600 hover:bg-zinc-500 text-zinc-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Rôles</label>
                      <div className="space-y-2">
                        {['config_creator', 'room_creator', 'admin'].map(role => (
                          <label key={role} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editRoles.includes(role)}
                              onChange={() => toggleRole(role, editRoles, setEditRoles)}
                              className="w-4 h-4 cursor-pointer"
                            />
                            <span className="text-sm text-zinc-300">
                              {role === 'config_creator' && 'Config Creator'}
                              {role === 'room_creator' && 'Room Creator'}
                              {role === 'admin' && 'Admin'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Photo de profil</label>
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                            onChange={handleEditImageUpload}
                            disabled={uploadingEditImage}
                            className="flex-1 text-sm text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer file:transition-colors disabled:opacity-50"
                          />
                          {uploadingEditImage && <span className="text-xs text-zinc-400">Téléchargement...</span>}
                        </div>
                        {editProfilePicture && (
                          <div className="flex items-center gap-2">
                            <img src={editProfilePicture} alt="Aperçu" className="w-12 h-12 rounded-lg object-cover border border-zinc-700" />
                            <button
                              onClick={() => updateProfilePicture(user.id, editProfilePicture)}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                            >
                              Enregistrer cette image
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditProfilePicture('')}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                        {user.profile_picture_url && !editProfilePicture && (
                          <div className="flex items-center gap-2">
                            <img src={user.profile_picture_url} alt="Photo actuelle" className="w-12 h-12 rounded-lg object-cover border border-zinc-700" />
                            <span className="text-xs text-zinc-500">Photo actuelle</span>
                            <button
                              onClick={() => deleteProfilePicture(user.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                            >
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Nouveau mot de passe (optionnel)</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Nouveau mot de passe..."
                          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 text-sm"
                        />
                        {editPassword && (
                          <button
                            onClick={() => updateUserPassword(user.id, editPassword)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                          >
                            Modifier
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-medium text-zinc-200">{user.name}</h3>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {user.roles.length === 0 ? (
                          <span className="text-xs bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded">
                            Aucun rôle
                          </span>
                        ) : (
                          user.roles.map(role => (
                            <span key={role} className={`text-xs px-2 py-0.5 rounded ${
                              role === 'admin' ? 'bg-red-900/30 text-red-400' :
                              role === 'config_creator' ? 'bg-purple-900/30 text-purple-400' :
                              role === 'room_creator' ? 'bg-blue-900/30 text-blue-400' :
                              'bg-zinc-800/60 text-zinc-400'
                            }`}>
                              {role}
                            </span>
                          ))
                        )}
                        {user.in_game && (
                          <span className="text-xs bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded">En jeu</span>
                        )}
                        <span className="text-xs text-zinc-500">
                          Créé le {new Date(user.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setEditRoles([...user.roles]);
                          setEditPassword('');
                          setEditProfilePicture(user.profile_picture_url || '');
                        }}
                        className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.name)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
