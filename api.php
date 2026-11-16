<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");

$dbFile = 'db.json';

function getDb() {
    global $dbFile;
    if (!file_exists($dbFile)) {
        return ["users" => [], "posts" => []];
    }
    return json_decode(file_get_contents($dbFile), true);
}

function saveDb($data) {
    global $dbFile;
    file_put_contents($dbFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

if ($method === 'GET' && $action === 'get_posts') {
    $db = getDb();
    echo json_encode($db['posts']);
    exit;
}

if ($method === 'POST') {
    $db = getDb();

    if ($action === 'register') {
        $username = trim($input['username'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (!$username || !$email || !$password) {
            echo json_encode(["success" => false, "message" => "Compila tutti i campi."]);
            exit;
        }

        foreach ($db['users'] as $u) {
            if ($u['email'] === $email || $u['username'] === $username) {
                echo json_encode(["success" => false, "message" => "Username o email già registrati."]);
                exit;
            }
        }

        $newUser = [
            "id" => time(),
            "username" => $username,
            "email" => $email,
            "password" => $password
        ];
        
        $db['users'][] = $newUser;
        saveDb($db);

        echo json_encode(["success" => true, "message" => "Registrazione completata!", "user" => ["username" => $username]]);
        exit;
    }

    if ($action === 'login') {
        $identifier = trim($input['identifier'] ?? '');
        $password = $input['password'] ?? '';

        foreach ($db['users'] as $u) {
            if (($u['email'] === $identifier || $u['username'] === $identifier) && $u['password'] === $password) {
                echo json_encode(["success" => true, "message" => "Login effettuato!", "user" => ["username" => $u['username']]]);
                exit;
            }
        }

        echo json_encode(["success" => false, "message" => "Credenziali non valide."]);
        exit;
    }

    if ($action === 'create_post') {
        $channel = $input['channel'] ?? 'tecnologia';
        $author = $input['author'] ?? 'u/ospite';
        $title = trim($input['title'] ?? '');
        $content = trim($input['content'] ?? '');

        if (!$title || !$content) {
            echo json_encode(["success" => false, "message" => "Titolo e contenuto obbligatori."]);
            exit;
        }

        $newPost = [
            "id" => time(),
            "channel" => $channel,
            "author" => $author,
            "title" => $title,
            "content" => $content,
            "votes" => 1,
            "comments" => 0,
            "time" => "Proprio ora"
        ];

        array_unshift($db['posts'], $newPost);
        saveDb($db);

        echo json_encode(["success" => true, "message" => "Post creato con successo!", "post" => $newPost]);
        exit;
    }

    if ($action === 'delete_post') {
        $postId = $input['id'] ?? null;
        $author = $input['author'] ?? '';

        if (!$postId || !$author) {
            echo json_encode(["success" => false, "message" => "Dati mancanti per l'eliminazione."]);
            exit;
        }

        $found = false;
        $updatedPosts = [];

        foreach ($db['posts'] as $post) {
            if ($post['id'] == $postId && $post['author'] === $author) {
                $found = true;
                continue;
            }
            $updatedPosts[] = $post;
        }

        if ($found) {
            $db['posts'] = $updatedPosts;
            saveDb($db);
            echo json_encode(["success" => true, "message" => "Post eliminato."]);
        } else {
            echo json_encode(["success" => false, "message" => "Post non trovato o non autorizzato."]);
        }
        exit;
    }
}

echo json_encode(["success" => false, "message" => "Azione non valida."]);
?>